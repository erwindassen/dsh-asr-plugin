import { finished } from "node:stream/promises";
import { decodeFrames, writeFrame } from "../worker/framing.js";
import { parseRecordingFinalizeMessage, parseRecordingWorkerMessage, } from "./worker-messages.js";
import { RECORDING_PROTOCOL_VERSION } from "./worker-types.js";
const ERROR_CODES = new Set([
    "INVALID_REQUEST",
    "ASSET_MISMATCH",
    "AUDIO_READ_FAILED",
    "MODEL_LOAD_FAILED",
    "MODEL_INFERENCE_FAILED",
    "NATIVE_LOAD_FAILED",
    "NATIVE_FAILURE",
    "RESOURCE_LIMIT",
    "INTERNAL_ERROR",
]);
const STAGES = new Set([
    "initializing",
    "vad",
    "asr",
    "fbank",
    "embed",
    "cluster",
    "assign",
]);
const ERROR_MESSAGES = {
    INVALID_REQUEST: "Recording Worker request is invalid",
    ASSET_MISMATCH: "Recording Worker assets failed verification",
    AUDIO_READ_FAILED: "Closed recording audio could not be read",
    MODEL_LOAD_FAILED: "Recording model failed to load",
    MODEL_INFERENCE_FAILED: "Recording model inference failed",
    NATIVE_LOAD_FAILED: "Recording native runtime failed to load",
    NATIVE_FAILURE: "Recording native runtime failed",
    RESOURCE_LIMIT: "Recording Worker resource limit was exceeded",
    INTERNAL_ERROR: "Recording Worker failed internally",
};
class InvalidRecordingInput extends Error {
}
async function endWritable(stream) {
    if (stream.destroyed)
        return;
    stream.end();
    await finished(stream, { cleanup: true, readable: false }).catch(() => undefined);
}
async function finishStreams(options) {
    await endWritable(options.output);
    await endWritable(options.diagnostics);
}
function diagnostic(stream, code) {
    if (!stream.destroyed)
        stream.write(`RECORDING_WORKER ${code}\n`);
}
async function writeMessage(output, message) {
    parseRecordingWorkerMessage(message);
    await writeFrame(output, message);
}
async function writeReady(options, runtime, loadMs) {
    await writeMessage(options.output, {
        type: "ready",
        recording_protocol_version: RECORDING_PROTOCOL_VERSION,
        kind: "recording",
        engine_fingerprint: runtime.engineFingerprint,
        load_ms: Math.max(0, Math.round(loadMs)),
    });
}
function rawCode(error) {
    if (typeof error === "object" && error !== null && "code" in error) {
        const code = error.code;
        if (typeof code === "string" && ERROR_CODES.has(code)) {
            return code;
        }
    }
    return "INTERNAL_ERROR";
}
function rawStage(error, fallback) {
    if (typeof error === "object" && error !== null && "stage" in error) {
        const stage = error.stage;
        if (typeof stage === "string" && STAGES.has(stage)) {
            return stage;
        }
    }
    return fallback;
}
async function writeError(options, error, requestId, fallbackStage) {
    const code = rawCode(error);
    await writeMessage(options.output, {
        type: "error",
        request_id: requestId,
        code,
        stage: rawStage(error, fallbackStage),
        message: ERROR_MESSAGES[code],
    });
}
async function closeRuntime(runtime) {
    try {
        await runtime.close();
        return undefined;
    }
    catch (error) {
        return error;
    }
}
async function readFinalize(input) {
    try {
        const iterator = decodeFrames(input)[Symbol.asyncIterator]();
        const first = await iterator.next();
        if (first.done)
            throw new InvalidRecordingInput("FINALIZE is missing");
        const message = parseRecordingFinalizeMessage(first.value);
        const extra = await iterator.next();
        if (!extra.done)
            throw new InvalidRecordingInput("Worker accepts one FINALIZE");
        return message;
    }
    catch (error) {
        if (error instanceof InvalidRecordingInput)
            throw error;
        throw new InvalidRecordingInput("FINALIZE is invalid", { cause: error });
    }
}
function unexpectedDraftEnd(task) {
    return task.then(() => Promise.reject(new Error("Recording draft loop ended before FINALIZE")), (error) => Promise.reject(error));
}
async function stopDrafts(controller, task) {
    controller.abort();
    try {
        await task;
        return undefined;
    }
    catch (error) {
        return error;
    }
}
function startDrafts(options, runtime, controller) {
    return runtime.runDrafts({
        signal: controller.signal,
        publishRevision: (message) => writeMessage(options.output, message),
        publishWarning: (message) => writeMessage(options.output, message),
    });
}
async function failInitialization(options, error, runtime) {
    if (runtime !== undefined)
        await closeRuntime(runtime);
    try {
        await writeError(options, error, null, "initializing");
    }
    catch {
        diagnostic(options.diagnostics, "INITIALIZATION_FAILED");
    }
    await finishStreams(options);
    return 1;
}
async function failBeforeFinalize(options, runtime, controller, draftTask, error) {
    await stopDrafts(controller, draftTask);
    await closeRuntime(runtime);
    if (error instanceof InvalidRecordingInput) {
        diagnostic(options.diagnostics, "INVALID_REQUEST");
    }
    else {
        await writeError(options, error, null, "asr").catch(() => {
            diagnostic(options.diagnostics, "DRAFT_FAILED");
        });
    }
    await finishStreams(options);
    return 1;
}
async function finishFinalization(options, runtime, finalize) {
    let payload;
    let failure;
    try {
        payload = await runtime.finalize(finalize);
    }
    catch (error) {
        failure = error;
    }
    failure ??= await closeRuntime(runtime);
    try {
        if (failure !== undefined) {
            await writeError(options, failure, finalize.request_id, "asr");
            return 1;
        }
        await writeMessage(options.output, {
            type: "final_result",
            request_id: finalize.request_id,
            base_transcript_version: finalize.base_transcript_version,
            engine_fingerprint: runtime.engineFingerprint,
            payload,
        });
        return 0;
    }
    catch {
        diagnostic(options.diagnostics, "INTERNAL_ERROR");
        return 1;
    }
    finally {
        await finishStreams(options);
    }
}
export async function runRecordingWorkerServer(options) {
    const started = performance.now();
    let runtime;
    try {
        runtime = await options.load();
        await writeReady(options, runtime, performance.now() - started);
    }
    catch (error) {
        return failInitialization(options, error, runtime);
    }
    const controller = new AbortController();
    const draftTask = startDrafts(options, runtime, controller);
    let finalize;
    try {
        finalize = await Promise.race([readFinalize(options.input), unexpectedDraftEnd(draftTask)]);
    }
    catch (error) {
        return failBeforeFinalize(options, runtime, controller, draftTask, error);
    }
    const draftFailure = await stopDrafts(controller, draftTask);
    if (draftFailure !== undefined) {
        return failBeforeFinalize(options, runtime, controller, draftTask, draftFailure);
    }
    return finishFinalization(options, runtime, finalize);
}
//# sourceMappingURL=worker-server.js.map