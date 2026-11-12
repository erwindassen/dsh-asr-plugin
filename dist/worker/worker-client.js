import { decodeFrames, FrameProtocolError, writeFrame } from "./framing.js";
import { assertPositiveTimeout, assertWorkerLaunch, closeWorkerInput, EMPTY_STDERR, requireWorkerStreams, requireWorkerTreeExit, settleWorkerFailure, waitBounded, WorkerProcessFailure, WorkerWaitFailure, } from "./client-process.js";
import { WorkerHostState, WorkerProtocolError } from "./host-state.js";
import { parseRunMessage, parseWorkerMessage, WorkerSchemaError } from "./messages.js";
import { drainStderrTail } from "./stderr-tail.js";
export class WorkerClientError extends Error {
    code;
    outcome;
    phase;
    stage;
    stderrTail;
    stderrTruncated;
    constructor(code, message, details) {
        super(message, details.cause === undefined ? undefined : { cause: details.cause });
        this.name = "WorkerClientError";
        this.code = code;
        this.outcome = details.outcome;
        this.phase = details.phase;
        this.stage = details.stage;
        this.stderrTail = details.stderr.text;
        this.stderrTruncated = details.stderr.truncated;
    }
    static cancelled(phase) {
        return new WorkerClientError("WORKER_CANCELLED", "Worker was cancelled", {
            phase,
            stderr: EMPTY_STDERR,
        });
    }
}
function assertOptions(options) {
    if (!/^[0-9a-f]{64}$/.test(options.expectedFingerprint)) {
        throw new TypeError("Worker fingerprint must be lowercase SHA-256");
    }
    assertWorkerLaunch(options.launch);
    assertPositiveTimeout(options.readyTimeoutMs);
    assertPositiveTimeout(options.runDeadlineMs);
    assertPositiveTimeout(options.terminationTimeoutMs);
}
async function sendRun(stream, run) {
    await writeFrame(stream, run);
    await closeWorkerInput(stream);
}
function classifyFailure(failure, settlement, stderr) {
    const details = { cause: failure, stderr, ...settlement };
    if (!settlement.quiet || settlement.outcome === undefined) {
        return new WorkerClientError("WORKER_PROCESS_ERROR", "Worker process did not converge", details);
    }
    if (failure instanceof WorkerWaitFailure) {
        const code = failure.reason === "cancelled" ? "WORKER_CANCELLED" : "WORKER_TIMEOUT";
        return new WorkerClientError(code, failure.message, { ...details, phase: failure.phase });
    }
    if (failure instanceof FrameProtocolError ||
        failure instanceof WorkerSchemaError ||
        failure instanceof WorkerProtocolError)
        return new WorkerClientError("WORKER_PROTOCOL_ERROR", "Worker violated the protocol", details);
    return new WorkerClientError("WORKER_PROCESS_ERROR", "Worker process failed", details);
}
function remoteFailure(terminal, stderr) {
    return new WorkerClientError(terminal.message.code, terminal.message.message, {
        stage: terminal.message.stage,
        stderr,
    });
}
export class WorkerClient {
    options;
    constructor(options) {
        this.options = options;
        assertOptions(options);
    }
    async run(rawRun, runOptions = {}) {
        let run;
        try {
            run = parseRunMessage(rawRun, this.options.kind);
        }
        catch (error) {
            throw new WorkerClientError("WORKER_PROTOCOL_ERROR", "Host RUN violates the protocol", {
                cause: error,
                stderr: EMPTY_STDERR,
            });
        }
        if (runOptions.signal?.aborted === true) {
            throw WorkerClientError.cancelled("ready");
        }
        let handle;
        try {
            handle = this.options.spawner.spawn(this.options.launch);
        }
        catch (error) {
            throw new WorkerClientError("WORKER_PROCESS_ERROR", "Worker process failed to spawn", {
                cause: error,
                stderr: EMPTY_STDERR,
            });
        }
        return this.runSpawned(handle, run, runOptions);
    }
    async runSpawned(handle, run, runOptions) {
        const stderrPromise = handle.stderr === undefined
            ? Promise.resolve(EMPTY_STDERR)
            : drainStderrTail(handle.stderr);
        let terminal;
        try {
            const streams = requireWorkerStreams(handle);
            terminal = await this.drive(handle, streams, run, runOptions);
        }
        catch (failure) {
            const settlement = await settleWorkerFailure(handle, this.options.terminationTimeoutMs);
            const stderr = await stderrPromise;
            throw classifyFailure(failure, settlement, stderr);
        }
        const stderr = await stderrPromise;
        if (terminal.type === "error")
            throw remoteFailure(terminal, stderr);
        return terminal.message;
    }
    async drive(handle, streams, run, runOptions) {
        const state = new WorkerHostState({
            expectedFingerprint: this.options.expectedFingerprint,
            run,
        });
        let phase = "ready";
        let deadline = performance.now() + this.options.readyTimeoutMs;
        for await (const frame of this.readFrames(streams.stdout, runOptions.signal, () => ({ phase, deadline }))) {
            const message = parseWorkerMessage(frame, this.options.kind);
            const event = state.receive(message);
            if (event.type === "send_run") {
                if (message.type !== "ready")
                    throw new WorkerProtocolError();
                runOptions.onReady?.(message);
                phase = "run";
                deadline = performance.now() + this.options.runDeadlineMs;
                await waitBounded(sendRun(streams.stdin, run), runOptions.signal, deadline, phase);
            }
            else if (event.type === "progress")
                runOptions.onProgress?.(event.message);
        }
        const outcome = await waitBounded(handle.done, runOptions.signal, deadline, phase);
        await requireWorkerTreeExit(handle, runOptions.signal, deadline, phase, this.options.terminationTimeoutMs);
        if (outcome.signal !== null)
            throw new WorkerProcessFailure("Worker was killed by a signal");
        return state.finish(outcome);
    }
    async *readFrames(stdout, signal, timing) {
        const iterator = decodeFrames(stdout)[Symbol.asyncIterator]();
        while (true) {
            const { phase, deadline } = timing();
            const next = await waitBounded(iterator.next(), signal, deadline, phase);
            if (next.done)
                return;
            yield next.value;
        }
    }
}
//# sourceMappingURL=worker-client.js.map