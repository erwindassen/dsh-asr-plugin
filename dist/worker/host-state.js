import { MAX_PROGRESS_MESSAGES } from "./messages.js";
export class WorkerProtocolError extends Error {
    code = "WORKER_PROTOCOL_ERROR";
    constructor(message = "Worker violated the protocol") {
        super(message);
        this.name = "WorkerProtocolError";
    }
}
function protocolFailure() {
    throw new WorkerProtocolError();
}
function assertResultIdentity(result, run) {
    if (result.request_id !== run.request_id ||
        result.kind !== run.kind ||
        result.base_transcript_version !== run.base_transcript_version)
        protocolFailure();
}
function assertAsrTimeline(result, durationMs) {
    if (result.payload.blocks.some((block) => block.end_ms > durationMs) ||
        result.payload.speech_regions.some((region) => region.end_ms > durationMs))
        protocolFailure();
}
function assertDiarizationConservation(result, run) {
    if (result.payload.segments.length !== run.payload.blocks.length)
        protocolFailure();
    for (const [index, block] of run.payload.blocks.entries()) {
        const segment = result.payload.segments[index];
        if (segment === undefined ||
            segment.seq !== block.seq ||
            segment.start_ms !== block.start_ms ||
            segment.end_ms !== block.end_ms ||
            segment.text !== block.text)
            protocolFailure();
    }
}
function assertResult(result, run) {
    assertResultIdentity(result, run);
    if (result.kind === "asr" && run.kind === "asr") {
        assertAsrTimeline(result, run.payload.duration_ms);
        return;
    }
    if (result.kind === "diarization" && run.kind === "diarization") {
        assertDiarizationConservation(result, run);
        return;
    }
    protocolFailure();
}
export class WorkerHostState {
    options;
    phase = "awaiting_ready";
    progressCount = 0;
    terminal;
    constructor(options) {
        this.options = options;
    }
    receive(message) {
        if (this.phase === "terminal")
            protocolFailure();
        if (this.phase === "awaiting_ready")
            return this.receiveBeforeReady(message);
        return this.receiveWhileRunning(message);
    }
    receiveBeforeReady(message) {
        if (message.type === "ready")
            return this.acceptReady(message);
        if (message.type === "error" &&
            message.request_id === null &&
            message.stage === "initializing")
            return this.acceptTerminal({ type: "error", message });
        return protocolFailure();
    }
    acceptReady(message) {
        if (message.kind !== this.options.run.kind ||
            message.engine_fingerprint !== this.options.expectedFingerprint)
            protocolFailure();
        this.phase = "running";
        return { type: "send_run" };
    }
    receiveWhileRunning(message) {
        if (message.type === "progress")
            return this.acceptProgress(message);
        if (message.type === "result") {
            assertResult(message, this.options.run);
            return this.acceptTerminal({ type: "result", message });
        }
        if (message.type === "error" &&
            message.request_id === this.options.run.request_id &&
            message.stage !== "initializing")
            return this.acceptTerminal({ type: "error", message });
        return protocolFailure();
    }
    acceptProgress(message) {
        if (message.request_id !== this.options.run.request_id ||
            ++this.progressCount > MAX_PROGRESS_MESSAGES)
            protocolFailure();
        return { type: "progress", message };
    }
    acceptTerminal(terminal) {
        this.phase = "terminal";
        this.terminal = terminal;
        return { type: "terminal" };
    }
    finish(outcome) {
        const terminal = this.terminal;
        if (terminal === undefined || outcome.signal !== null)
            protocolFailure();
        if (terminal.type === "result" && outcome.exitCode !== 0)
            protocolFailure();
        if (terminal.type === "error" && outcome.exitCode !== 1)
            protocolFailure();
        return terminal;
    }
}
//# sourceMappingURL=host-state.js.map