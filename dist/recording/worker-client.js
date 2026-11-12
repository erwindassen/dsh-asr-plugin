import { FrameProtocolError, decodeFrames, writeFrame } from "../worker/framing.js";
import { assertPositiveTimeout, assertWorkerLaunch, closeWorkerInput, EMPTY_STDERR, requireWorkerStreams, requireWorkerTreeExit, settleWorkerFailure, waitAbortable, waitBounded, WorkerProcessFailure, WorkerWaitFailure, } from "../worker/client-process.js";
import { drainStderrTail } from "../worker/stderr-tail.js";
import { RecordingWorkerHostState, RecordingWorkerProtocolError, } from "./worker-host-state.js";
import { parseRecordingFinalizeMessage, parseRecordingWorkerMessage, RecordingWorkerSchemaError, } from "./worker-messages.js";
export class RecordingWorkerClientError extends Error {
    code;
    outcome;
    phase;
    stage;
    stderrTail;
    stderrTruncated;
    constructor(code, message, details) {
        super(message, details.cause === undefined ? undefined : { cause: details.cause });
        this.code = code;
        this.name = "RecordingWorkerClientError";
        this.outcome = details.outcome;
        this.phase = details.phase;
        this.stage = details.stage;
        this.stderrTail = details.stderr.text;
        this.stderrTruncated = details.stderr.truncated;
    }
    static cancelled(phase) {
        return new RecordingWorkerClientError("WORKER_CANCELLED", "Recording Worker was cancelled", {
            phase,
            stderr: EMPTY_STDERR,
        });
    }
}
function deferred() {
    let settled = false;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return {
        promise,
        resolve(value) {
            if (!settled) {
                settled = true;
                resolvePromise(value);
            }
        },
        reject(error) {
            if (!settled) {
                settled = true;
                rejectPromise(error);
            }
        },
    };
}
function assertOptions(options) {
    if (!/^[0-9a-f]{64}$/.test(options.expectedFingerprint)) {
        throw new TypeError("Recording Worker fingerprint must be lowercase SHA-256");
    }
    assertWorkerLaunch(options.launch);
    assertPositiveTimeout(options.readyTimeoutMs);
    assertPositiveTimeout(options.finalizeDeadlineMs);
    assertPositiveTimeout(options.terminationTimeoutMs);
}
function classifyFailure(failure, settlement, stderr) {
    const details = { cause: failure, stderr, ...settlement };
    if (!settlement.quiet || settlement.outcome === undefined) {
        return new RecordingWorkerClientError("WORKER_PROCESS_ERROR", "Recording Worker process did not converge", details);
    }
    if (failure instanceof WorkerWaitFailure) {
        const code = failure.reason === "cancelled" ? "WORKER_CANCELLED" : "WORKER_TIMEOUT";
        return new RecordingWorkerClientError(code, failure.message, {
            ...details,
            phase: failure.phase,
        });
    }
    if (failure instanceof FrameProtocolError ||
        failure instanceof RecordingWorkerSchemaError ||
        failure instanceof RecordingWorkerProtocolError) {
        return new RecordingWorkerClientError("WORKER_PROTOCOL_ERROR", "Recording Worker violated the protocol", details);
    }
    return new RecordingWorkerClientError("WORKER_PROCESS_ERROR", "Recording Worker process failed", details);
}
function remoteFailure(terminal, stderr) {
    return new RecordingWorkerClientError(terminal.message.code, terminal.message.message, {
        stage: terminal.message.stage,
        stderr,
    });
}
class ActiveRecordingWorkerSession {
    options;
    startOptions;
    handle;
    completion;
    ready = deferred();
    state;
    stopController = new AbortController();
    signal;
    phase = "ready";
    deadline;
    settled = false;
    localFailure;
    constructor(options, startOptions, handle) {
        this.options = options;
        this.startOptions = startOptions;
        this.handle = handle;
        this.state = new RecordingWorkerHostState({
            expectedFingerprint: options.expectedFingerprint,
        });
        this.signal = startOptions.signal === undefined
            ? this.stopController.signal
            : AbortSignal.any([startOptions.signal, this.stopController.signal]);
        this.deadline = performance.now() + options.readyTimeoutMs;
        this.completion = this.execute();
        this.completion.then(() => { this.settled = true; }, (error) => { this.settled = true; this.ready.reject(error); });
        void this.completion.catch(() => undefined);
    }
    waitUntilReady() {
        return this.ready.promise;
    }
    snapshot() {
        return this.state.snapshot();
    }
    async finalize(rawMessage) {
        let message;
        try {
            message = parseRecordingFinalizeMessage(rawMessage);
            this.state.beginFinalize(message);
        }
        catch (error) {
            throw new RecordingWorkerClientError("WORKER_PROTOCOL_ERROR", "Host FINALIZE violates the recording protocol", { cause: error, stderr: EMPTY_STDERR });
        }
        this.phase = "finalize";
        this.deadline = performance.now() + this.options.finalizeDeadlineMs;
        const streams = requireWorkerStreams(this.handle);
        const sending = this.sendFinalize(streams, message);
        try {
            await Promise.race([sending, this.completion]);
        }
        catch (error) {
            if (error instanceof RecordingWorkerClientError)
                throw error;
            this.localFailure = error;
            this.stopController.abort();
        }
        return this.completion;
    }
    async terminate() {
        if (this.settled)
            return;
        this.stopController.abort();
        try {
            await this.completion;
        }
        catch (error) {
            if (error instanceof RecordingWorkerClientError && error.code === "WORKER_CANCELLED")
                return;
            throw error;
        }
    }
    async sendFinalize(streams, message) {
        await waitBounded(writeFrame(streams.stdin, message), this.signal, this.deadline, "finalize");
        await waitBounded(closeWorkerInput(streams.stdin), this.signal, this.deadline, "finalize");
    }
    async execute() {
        const stderrPromise = this.handle.stderr === undefined
            ? Promise.resolve(EMPTY_STDERR)
            : drainStderrTail(this.handle.stderr);
        let terminal;
        try {
            terminal = await this.drive(requireWorkerStreams(this.handle));
        }
        catch (failure) {
            const settlement = await settleWorkerFailure(this.handle, this.options.terminationTimeoutMs);
            const stderr = await stderrPromise;
            throw classifyFailure(this.localFailure ?? failure, settlement, stderr);
        }
        const stderr = await stderrPromise;
        if (terminal.type === "error")
            throw remoteFailure(terminal, stderr);
        return terminal.message;
    }
    async drive(streams) {
        const iterator = decodeFrames(streams.stdout)[Symbol.asyncIterator]();
        while (true) {
            const next = await this.nextFrame(iterator);
            if (next.done)
                break;
            const message = parseRecordingWorkerMessage(next.value);
            const event = this.state.receive(message);
            if (event.type === "ready") {
                if (message.type !== "ready")
                    throw new RecordingWorkerProtocolError();
                this.phase = "recording";
                this.startOptions.onReady?.(message);
                this.ready.resolve(this);
            }
            else if (event.type === "revision") {
                this.startOptions.onRevision?.(event.snapshot);
            }
            else if (event.type === "warning") {
                this.startOptions.onWarning?.(event.message);
            }
            else if (this.phase !== "finalize") {
                this.phase = "termination";
                this.deadline = performance.now() + this.options.terminationTimeoutMs;
            }
        }
        if (this.phase === "ready" || this.phase === "recording") {
            this.phase = "termination";
            this.deadline = performance.now() + this.options.terminationTimeoutMs;
        }
        const outcome = await waitBounded(this.handle.done, this.signal, this.deadline, this.phase);
        await requireWorkerTreeExit(this.handle, this.signal, this.deadline, this.phase, this.options.terminationTimeoutMs);
        if (outcome.signal !== null)
            throw new WorkerProcessFailure("Recording Worker was signalled");
        return this.state.finish(outcome);
    }
    nextFrame(iterator) {
        const next = iterator.next();
        if (this.phase === "recording")
            return waitAbortable(next, this.signal, this.phase);
        return waitBounded(next, this.signal, this.deadline, this.phase);
    }
}
export class RecordingWorkerClient {
    options;
    constructor(options) {
        this.options = options;
        assertOptions(options);
    }
    async start(startOptions = {}) {
        if (startOptions.signal?.aborted === true) {
            throw RecordingWorkerClientError.cancelled("ready");
        }
        let handle;
        try {
            handle = this.options.spawner.spawn(this.options.launch);
        }
        catch (error) {
            throw new RecordingWorkerClientError("WORKER_PROCESS_ERROR", "Recording Worker process failed to spawn", { cause: error, stderr: EMPTY_STDERR });
        }
        return new ActiveRecordingWorkerSession(this.options, startOptions, handle).waitUntilReady();
    }
}
//# sourceMappingURL=worker-client.js.map