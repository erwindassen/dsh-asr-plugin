import { setTimeout as delay } from "node:timers/promises";
import { realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { StreamingBoundedVad } from "../asr/bounded-vad.js";
import { runFunAsrWithLoadedRuntime, } from "../asr/funasr/pipeline.js";
import { loadRecognitionEngine, punctuationAssetIds, recognitionAssetIds, } from "../asr/recognition.js";
import { loadVadModel } from "../asr/vad-model.js";
import { buildRecordingAudioCandidate } from "../audio/recording-audio-candidate.js";
import { openClosedRecordingChunks, ClosedRecordingChunkError } from "../audio/closed-recording-chunks.js";
import { RecordingTimelineError } from "../audio/recording-timeline.js";
import { loadMeetingDiarizationComponents } from "../diarization/factory.js";
import { createMeetingDiarizer, } from "../diarization/meeting-diarizer.js";
import { prepareManagedAudioRoot } from "../worker/managed-audio.js";
import { stageWorkerFailure, WorkerRuntimeError } from "../worker/worker-errors.js";
import { loadWorkerAssets, requiredAsset } from "../worker/worker-assets.js";
import { RecordingAuthoritativeEngine } from "./authoritative-engine.js";
import { RecordingDraftEngine, RecordingDraftResourceError, } from "./draft-engine.js";
import { createRecordingDraftRecognizer } from "./draft-recognizer.js";
import { openRecordingFinalCache } from "./final-cache.js";
import { RecordingWorkerSchemaError } from "./worker-messages.js";
const CADENCE_MS = 5_000;
export function recordingAssetIds(engine, mode) {
    return [
        "vad-model",
        "fbank-native",
        "speaker-embedding-model",
        "hcluster-native",
        ...recognitionAssetIds(engine),
        ...punctuationAssetIds(mode, engine),
    ];
}
async function closeComponents(components) {
    const operations = [
        components.vad?.close(),
        components.recognizer?.close(),
        components.punctuator?.close(),
        components.embeddingModel?.close(),
    ].filter((operation) => operation !== undefined);
    const outcomes = await Promise.allSettled(operations);
    const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
    if (failures.length === 1)
        throw failures[0];
    if (failures.length > 1)
        throw new AggregateError(failures, "Recording runtime failed to close");
}
async function loadComponents(paths, mode, engine) {
    const partial = {};
    try {
        const vad = await loadVadModel(requiredAsset(paths, "vad-model"));
        partial.vad = vad;
        const recognition = await loadRecognitionEngine(engine, {
            asrCmvnPath: paths["asr-cmvn"] ?? "",
            asrConfigPath: paths["asr-config"] ?? "",
            asrModelPath: paths["asr-model"] ?? "",
            asrTokensPath: paths["asr-tokens"] ?? "",
            fbankPath: requiredAsset(paths, "fbank-native"),
            parakeetDecoderPath: paths["parakeet-decoder"] ?? "",
            parakeetEncoderPath: paths["parakeet-encoder"] ?? "",
            parakeetJoinerPath: paths["parakeet-joiner"] ?? "",
            parakeetTokensPath: paths["parakeet-tokens"] ?? "",
            ...(mode === "enhanced" && engine !== "parakeet" ? {
                punctuationConfigPath: requiredAsset(paths, "punc-config"),
                punctuationModelPath: requiredAsset(paths, "punc-model"),
                punctuationTokensPath: requiredAsset(paths, "punc-tokens"),
            } : {}),
        });
        partial.recognizer = recognition.recognizer;
        const punctuator = recognition.loadPunctuator === undefined
            ? undefined : await recognition.loadPunctuator();
        if (punctuator !== undefined)
            partial.punctuator = punctuator;
        const diarization = await loadMeetingDiarizationComponents({
            embeddingModelPath: requiredAsset(paths, "speaker-embedding-model"),
            fbankPath: requiredAsset(paths, "fbank-native"),
            hclusterPath: requiredAsset(paths, "hcluster-native"),
        });
        partial.embeddingModel = diarization.embeddingModel;
        return {
            mode,
            vad,
            recognizer: recognition.recognizer,
            punctuator,
            clusterer: diarization.clusterer,
            embeddingModel: diarization.embeddingModel,
        };
    }
    catch (error) {
        await closeComponents(partial).catch(() => undefined);
        throw error;
    }
}
function assertInside(root, child) {
    const pathFromRoot = relative(root, child);
    if (pathFromRoot === "" ||
        pathFromRoot === ".." ||
        pathFromRoot.startsWith(`..${sep}`))
        throw new WorkerRuntimeError("INVALID_REQUEST", "Recording path escapes its allowed root");
}
async function canonicalDirectory(root, ...parts) {
    try {
        const child = await realpath(join(root, ...parts));
        assertInside(root, child);
        if (!(await stat(child)).isDirectory())
            throw new Error("not a directory");
        return child;
    }
    catch (error) {
        if (error instanceof WorkerRuntimeError)
            throw error;
        throw new WorkerRuntimeError("INVALID_REQUEST", "Recording directory is invalid", undefined, {
            cause: error,
        });
    }
}
async function abortableDelay(milliseconds, signal) {
    if (milliseconds <= 0 || signal.aborted)
        return;
    try {
        await delay(milliseconds, undefined, { signal });
    }
    catch (error) {
        if (!signal.aborted)
            throw error;
    }
}
function warningFor(error) {
    if (error instanceof RecordingDraftResourceError ||
        error instanceof RecordingWorkerSchemaError ||
        (typeof error === "object" && error !== null && "code" in error &&
            error.code === "RESOURCE_LIMIT"))
        throw error;
    if (error instanceof ClosedRecordingChunkError || error instanceof RecordingTimelineError) {
        return {
            code: "CHUNK_TEMPORARILY_UNREADABLE",
            message: "A closed recording chunk is temporarily unreadable",
        };
    }
    return { code: "DRAFT_INFERENCE_FAILED", message: "Draft inference failed" };
}
async function publishWarningOnce(options, active, warning) {
    if (active.has(warning.code))
        return;
    active.add(warning.code);
    await options.publishWarning({ type: "warning", stage: "asr", ...warning });
}
async function runDraftLoop(draft, authoritative, options) {
    const activeWarnings = new Set();
    let nextTick = performance.now();
    while (!options.signal.aborted) {
        nextTick += CADENCE_MS;
        try {
            while (!options.signal.aborted) {
                const revision = await draft.nextRevision();
                if (revision === null)
                    break;
                await options.publishRevision(revision);
                activeWarnings.clear();
            }
            if (!options.signal.aborted)
                await authoritative.advance();
        }
        catch (error) {
            await publishWarningOnce(options, activeWarnings, warningFor(error));
        }
        if (performance.now() > nextTick) {
            await publishWarningOnce(options, activeWarnings, {
                code: "DRAFT_STALE",
                message: "Draft processing is behind the recording cadence",
            });
        }
        while (nextTick <= performance.now())
            nextTick += CADENCE_MS;
        await abortableDelay(nextTick - performance.now(), options.signal);
    }
}
function createAuthoritativeEngine(components, chunks, cache, engineFingerprint) {
    return new RecordingAuthoritativeEngine({
        cache,
        chunks,
        engineFingerprint,
        kernels: {
            embeddingModel: components.embeddingModel,
            createVad: (reader) => new StreamingBoundedVad(reader, components.vad),
            async transcribe(reader, regions) {
                try {
                    return await runFunAsrWithLoadedRuntime(reader, regions, {
                        recognizer: components.recognizer,
                        mode: components.mode,
                        ...(components.punctuator === undefined ? {} : { punctuator: components.punctuator }),
                    });
                }
                catch (error) {
                    throw stageWorkerFailure(error, "asr", "asr");
                }
            },
            async diarize(reader, blocks, speechRegions, cachedEmbeddingModel) {
                const diarizer = createMeetingDiarizer({
                    clusterer: components.clusterer,
                    embeddingModel: cachedEmbeddingModel,
                });
                try {
                    return await diarizer.diarize(reader, blocks, speechRegions);
                }
                catch (error) {
                    throw stageWorkerFailure(error, "diarization", "cluster");
                }
                finally {
                    await diarizer.close().catch(() => undefined);
                }
            },
        },
    });
}
function finalPayload(finalized, candidate, started) {
    if (finalized.durationMs !== candidate.durationMs) {
        throw new WorkerRuntimeError("AUDIO_READ_FAILED", "Final audio duration changed", "asr");
    }
    return {
        duration_ms: candidate.durationMs,
        source_size_bytes: candidate.sourceSizeBytes,
        source_sha256: candidate.sourceSha256,
        result_status: finalized.resultStatus,
        result_reason: finalized.resultReason,
        segments: finalized.segments.map((segment) => ({
            seq: segment.seq,
            start_ms: segment.startMs,
            end_ms: segment.endMs,
            speaker_label: segment.speakerLabel,
            text: segment.text,
        })),
        audio_files: candidate.audioFiles,
        metrics: {
            finalization_ms: Math.max(0, Math.round(performance.now() - started)),
            max_rss_bytes: process.resourceUsage().maxRSS * 1_024,
            cache_hits: finalized.cacheHits,
            cache_misses: finalized.cacheMisses,
        },
    };
}
async function finalizeRecording(message, authoritative, candidateChunks, paths) {
    const started = performance.now();
    const outcomes = await Promise.allSettled([
        authoritative.finalize(),
        buildRecordingAudioCandidate(paths, candidateChunks),
    ]);
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : []);
    if (failures.length === 1)
        throw failures[0];
    if (failures.length > 1)
        throw new AggregateError(failures, "Recording finalization failed");
    const finalized = outcomes[0].status === "fulfilled" ? outcomes[0].value : undefined;
    const candidate = outcomes[1].status === "fulfilled" ? outcomes[1].value : undefined;
    if (finalized === undefined || candidate === undefined) {
        throw new WorkerRuntimeError("INTERNAL_ERROR", "Recording finalization did not settle", "asr");
    }
    if (candidate.captureEndUs > message.capture_end_us) {
        throw new WorkerRuntimeError("INVALID_REQUEST", "Capture boundary precedes closed audio", "asr");
    }
    return finalPayload(finalized, candidate, started);
}
function workerAssetConfig(config, meetingsRoot) {
    return {
        ...(config.processing === undefined ? {} : { processing: config.processing }),
        modelRoot: config.modelRoot,
        packagedNativeRoot: config.packagedNativeRoot,
        manifestPath: config.manifestPath,
        managedAudioDirectory: meetingsRoot,
    };
}
async function openRecordingRuntime(config, assets, components) {
    const meeting = await canonicalDirectory(config.meetingsRoot, config.meetingId);
    const recording = await canonicalDirectory(meeting, "recording");
    const workRecording = await canonicalDirectory(config.workRoot, config.meetingId, "recording");
    const chunks = await openClosedRecordingChunks(recording);
    const candidateChunks = await openClosedRecordingChunks(recording);
    const draft = new RecordingDraftEngine({
        chunks,
        recognize: createRecordingDraftRecognizer(components.vad, {
            recognizer: components.recognizer, mode: components.mode,
            ...(components.punctuator === undefined ? {} : { punctuator: components.punctuator }),
        }),
    });
    const authoritative = createAuthoritativeEngine(components, chunks, await openRecordingFinalCache(join(workRecording, "authoritative-cache"), assets.engineFingerprint), assets.engineFingerprint);
    const paths = { meetingDirectory: meeting, recordingDirectory: recording, workRecordingDirectory: workRecording };
    return {
        engineFingerprint: assets.engineFingerprint,
        runDrafts: (options) => runDraftLoop(draft, authoritative, options),
        finalize: (message) => finalizeRecording(message, authoritative, candidateChunks, paths),
        close: async () => { },
    };
}
export async function loadRecordingModels(config) {
    const meetingsRoot = await prepareManagedAudioRoot(config.meetingsRoot);
    const workRoot = await prepareManagedAudioRoot(config.workRoot);
    const mode = config.processing?.identity.mode ?? "enhanced";
    const engine = config.processing?.identity.engine ?? "paraformer";
    const assets = await loadWorkerAssets(workerAssetConfig(config, meetingsRoot), recordingAssetIds(engine, mode));
    if (assets.engineFingerprint !== config.expectedFingerprint) {
        throw new WorkerRuntimeError("ASSET_MISMATCH", "Recording engine fingerprint changed");
    }
    const components = await loadComponents(assets.paths, mode, engine);
    return {
        engineFingerprint: assets.engineFingerprint,
        createSession: (meetingId, runId) => openRecordingRuntime({ ...config, meetingsRoot, workRoot, meetingId, runId }, assets, components),
        close: () => closeComponents(components),
    };
}
export async function loadRecordingWorkerRuntime(config) {
    const models = await loadRecordingModels(config);
    try {
        const session = await models.createSession(config.meetingId, config.runId);
        return { ...session, close: () => models.close() };
    }
    catch (error) {
        await models.close().catch(() => undefined);
        throw error;
    }
}
//# sourceMappingURL=worker-runtime.js.map