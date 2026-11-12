import { finished } from "node:stream/promises";
import { decodeFrames, writeFrame } from "./framing.js";
import { parseRunMessage, parseWorkerMessage } from "./messages.js";
import { WORKER_PROTOCOL_VERSION } from "./types.js";
import { sanitizeWorkerFailure } from "./worker-errors.js";
class InvalidWorkerInput extends Error {
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
        stream.write(`WORKER ${code}\n`);
}
async function readSingleRun(input, kind) {
    const iterator = decodeFrames(input)[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done)
        throw new InvalidWorkerInput("RUN is missing");
    const run = parseRunMessage(first.value, kind);
    const extra = await iterator.next();
    if (!extra.done)
        throw new InvalidWorkerInput("Worker accepts exactly one RUN");
    return run;
}
async function writeMessage(output, message) {
    await writeFrame(output, message);
}
async function writeReady(options, runtime, loadMs) {
    const message = {
        type: "ready",
        protocol_version: WORKER_PROTOCOL_VERSION,
        kind: options.kind,
        engine_fingerprint: runtime.engineFingerprint,
        load_ms: Math.max(0, Math.round(loadMs)),
    };
    parseWorkerMessage(message, options.kind);
    await writeMessage(options.output, message);
}
function resultMessage(kind, run, payload) {
    return {
        type: "result",
        request_id: run.request_id,
        kind,
        base_transcript_version: run.base_transcript_version,
        payload,
    };
}
async function writeError(options, error, requestId, fallbackStage) {
    const failure = sanitizeWorkerFailure(error, options.kind, fallbackStage);
    const message = { type: "error", request_id: requestId, ...failure };
    parseWorkerMessage(message, options.kind);
    await writeMessage(options.output, message);
}
function progressReporter(options, run) {
    let count = 0;
    return async (stage, ratio) => {
        if (++count > 1_000)
            throw new Error("Worker emitted too many progress messages");
        const message = { type: "progress", request_id: run.request_id, stage, ratio };
        parseWorkerMessage(message, options.kind);
        await writeMessage(options.output, message);
    };
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
async function failUntrustedInput(options, runtime) {
    await closeRuntime(runtime);
    diagnostic(options.diagnostics, "INVALID_REQUEST");
    await finishStreams(options);
    return 1;
}
async function finishExecution(options, runtime, run) {
    let payload;
    let failure;
    try {
        payload = await runtime.execute(run, progressReporter(options, run));
    }
    catch (error) {
        failure = error;
    }
    const closeFailure = await closeRuntime(runtime);
    failure ??= closeFailure;
    try {
        if (failure !== undefined) {
            await writeError(options, failure, run.request_id, options.kind === "asr" ? "asr" : "embed");
            return 1;
        }
        const message = resultMessage(options.kind, run, payload);
        try {
            parseWorkerMessage(message, options.kind);
        }
        catch (error) {
            await writeError(options, error, run.request_id, options.kind === "asr" ? "asr" : "embed");
            return 1;
        }
        await writeMessage(options.output, message);
        return 0;
    }
    catch (error) {
        diagnostic(options.diagnostics, "INTERNAL_ERROR");
        return 1;
    }
    finally {
        await finishStreams(options);
    }
}
export async function runWorkerServer(options) {
    const started = performance.now();
    let runtime;
    try {
        runtime = await options.load();
        await writeReady(options, runtime, performance.now() - started);
    }
    catch (error) {
        return failInitialization(options, error, runtime);
    }
    let run;
    try {
        run = await readSingleRun(options.input, options.kind);
    }
    catch {
        return failUntrustedInput(options, runtime);
    }
    return finishExecution(options, runtime, run);
}
//# sourceMappingURL=worker-server.js.map