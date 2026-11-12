import { runBoundedVad } from "../asr/bounded-vad.js";
import { runFunAsr } from "../asr/funasr/pipeline.js";
import { loadRecognitionEngine, punctuationAssetIds, recognitionAssetIds, } from "../asr/recognition.js";
import { loadVadModel } from "../asr/vad-model.js";
import { openManagedPcm16Wav, prepareManagedAudioRoot } from "./managed-audio.js";
import { stageWorkerFailure } from "./worker-errors.js";
import { loadWorkerAssets, requiredAsset } from "./worker-assets.js";
export function asrAssetIds(engine, mode) {
    return [
        "vad-model",
        ...(engine === "parakeet" ? [] : ["fbank-native"]),
        ...recognitionAssetIds(engine),
        ...punctuationAssetIds(mode, engine),
    ];
}
function pathOrEmpty(paths, id) {
    return paths[id] ?? "";
}
function runtimeFactory(recognizer, loadPunctuator) {
    return {
        async loadRecognizer() { return recognizer; },
        ...(loadPunctuator === undefined ? {} : { loadPunctuator }),
    };
}
async function closeComponents(components) {
    const outcomes = await Promise.allSettled([
        components.vad?.close(),
        components.recognizer?.close(),
    ].filter((operation) => operation !== undefined));
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : []);
    if (failures.length === 1)
        throw failures[0];
    if (failures.length > 1)
        throw new AggregateError(failures, "ASR runtime failed to close");
}
async function loadComponents(paths, mode, engine) {
    const partial = {};
    try {
        partial.vad = await loadVadModel(requiredAsset(paths, "vad-model"));
        const recognition = await loadRecognitionEngine(engine, {
            asrCmvnPath: pathOrEmpty(paths, "asr-cmvn"),
            asrConfigPath: pathOrEmpty(paths, "asr-config"),
            asrModelPath: pathOrEmpty(paths, "asr-model"),
            asrTokensPath: pathOrEmpty(paths, "asr-tokens"),
            fbankPath: pathOrEmpty(paths, "fbank-native"),
            parakeetDecoderPath: pathOrEmpty(paths, "parakeet-decoder"),
            parakeetEncoderPath: pathOrEmpty(paths, "parakeet-encoder"),
            parakeetJoinerPath: pathOrEmpty(paths, "parakeet-joiner"),
            parakeetTokensPath: pathOrEmpty(paths, "parakeet-tokens"),
            ...(mode === "enhanced" && engine !== "parakeet" ? {
                punctuationConfigPath: requiredAsset(paths, "punc-config"),
                punctuationModelPath: requiredAsset(paths, "punc-model"),
                punctuationTokensPath: requiredAsset(paths, "punc-tokens"),
            } : {}),
        });
        partial.recognizer = recognition.recognizer;
        return {
            engine,
            mode,
            vad: partial.vad,
            recognizer: recognition.recognizer,
            loadPunctuator: recognition.loadPunctuator,
        };
    }
    catch (error) {
        await closeComponents(partial).catch(() => undefined);
        throw error;
    }
}
function asrPayload(vad, asr, asrMs) {
    return {
        blocks: asr.blocks.map((block) => ({
            seq: block.seq,
            start_ms: block.startMs,
            end_ms: block.endMs,
            text: block.text,
        })),
        speech_regions: vad.speechRegions.map((region) => ({
            start_ms: region.startMs,
            end_ms: region.endMs,
        })),
        empty_reason: asr.emptyReason,
        metrics: {
            vad_ms: vad.metrics.vadMs,
            asr_ms: Math.max(0, Math.round(asrMs)),
            max_rss_bytes: process.resourceUsage().maxRSS * 1_024,
        },
    };
}
async function executeAsr(run, managedRoot, components, report) {
    const reader = await openManagedPcm16Wav(managedRoot, run.payload.audio_path, run.payload.duration_ms);
    try {
        await report("vad", 0);
        let vad;
        try {
            vad = await runBoundedVad(reader, components.vad);
        }
        catch (error) {
            throw stageWorkerFailure(error, "asr", "vad");
        }
        await report("vad", 1);
        await report("asr", 0);
        const started = performance.now();
        let asr;
        try {
            asr = await runFunAsr(reader, vad.asrChunks, runtimeFactory(components.recognizer, components.loadPunctuator), components.mode);
        }
        catch (error) {
            throw stageWorkerFailure(error, "asr", "asr");
        }
        const elapsed = performance.now() - started;
        await report("asr", 1);
        return asrPayload(vad, asr, elapsed);
    }
    finally {
        await reader.close();
    }
}
export async function loadAsrWorkerRuntime(config) {
    const mode = config.processing?.identity.mode ?? "enhanced";
    const engine = config.processing?.identity.engine ?? "paraformer";
    const assets = await loadWorkerAssets(config, asrAssetIds(engine, mode));
    const managedRoot = await prepareManagedAudioRoot(config.managedAudioDirectory);
    const components = await loadComponents(assets.paths, mode, engine);
    return {
        engineFingerprint: assets.engineFingerprint,
        execute: (run, report) => executeAsr(run, managedRoot, components, report),
        close: () => closeComponents({
            vad: components.vad,
            recognizer: components.recognizer,
        }),
    };
}
//# sourceMappingURL=asr-runtime.js.map