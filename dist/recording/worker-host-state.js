export class RecordingWorkerProtocolError extends Error {
    code = "WORKER_PROTOCOL_ERROR";
    constructor() {
        super("Recording Worker violated the protocol");
        this.name = "RecordingWorkerProtocolError";
    }
}
const MAX_SEGMENTS = 20_000;
function draftSegment(segment) {
    return {
        seq: segment.seq,
        startMs: segment.start_ms,
        endMs: segment.end_ms,
        speakerLabel: null,
        text: segment.text,
    };
}
function copySnapshot(snapshot) {
    return {
        ...snapshot,
        segments: snapshot.segments.map((segment) => ({ ...segment })),
    };
}
export class RecordingWorkerHostState {
    options;
    phase = "awaiting_ready";
    finalize;
    terminal;
    warningCount = 0;
    current = {
        revision: 0,
        audioThroughMs: 0,
        generatedAtMs: 0,
        segments: [],
    };
    constructor(options) {
        this.options = options;
    }
    receive(message) {
        if (this.phase === "awaiting_ready")
            return this.receiveBeforeReady(message);
        if (this.phase === "recording")
            return this.receiveWhileRecording(message);
        if (this.phase === "finalizing")
            return this.receiveWhileFinalizing(message);
        throw new RecordingWorkerProtocolError();
    }
    snapshot() {
        return copySnapshot(this.current);
    }
    beginFinalize(message) {
        if (this.phase !== "recording")
            throw new RecordingWorkerProtocolError();
        this.phase = "finalizing";
        this.finalize = message;
        return message;
    }
    finish(outcome) {
        const terminal = this.terminal;
        if (terminal === undefined || outcome.signal !== null)
            throw new RecordingWorkerProtocolError();
        if (terminal.type === "result" && outcome.exitCode !== 0)
            throw new RecordingWorkerProtocolError();
        if (terminal.type === "error" && outcome.exitCode !== 1)
            throw new RecordingWorkerProtocolError();
        return terminal;
    }
    receiveBeforeReady(message) {
        if (message.type === "ready") {
            if (message.engine_fingerprint !== this.options.expectedFingerprint) {
                throw new RecordingWorkerProtocolError();
            }
            this.phase = "recording";
            return { type: "ready" };
        }
        if (message.type === "error" && message.request_id === null && message.stage === "initializing") {
            return this.acceptTerminal({ type: "error", message });
        }
        throw new RecordingWorkerProtocolError();
    }
    receiveWhileRecording(message) {
        if (message.type === "revision") {
            this.current = this.applyRevision(message);
            return { type: "revision", snapshot: this.snapshot() };
        }
        if (message.type === "warning")
            return this.acceptWarning(message);
        if (message.type === "error" && message.request_id === null && message.stage !== "initializing") {
            return this.acceptTerminal({ type: "error", message });
        }
        throw new RecordingWorkerProtocolError();
    }
    receiveWhileFinalizing(message) {
        const finalize = this.finalize;
        if (finalize === undefined)
            throw new RecordingWorkerProtocolError();
        if (message.type === "revision") {
            this.current = this.applyRevision(message);
            return { type: "revision", snapshot: this.snapshot() };
        }
        if (message.type === "warning") {
            return this.acceptWarning(message);
        }
        if (message.type === "final_result") {
            if (message.request_id !== finalize.request_id ||
                message.base_transcript_version !== finalize.base_transcript_version ||
                message.engine_fingerprint !== this.options.expectedFingerprint)
                throw new RecordingWorkerProtocolError();
            return this.acceptTerminal({ type: "result", message });
        }
        if (message.type === "error" &&
            message.request_id === finalize.request_id &&
            message.stage !== "initializing") {
            return this.acceptTerminal({ type: "error", message });
        }
        throw new RecordingWorkerProtocolError();
    }
    acceptWarning(message) {
        if (++this.warningCount > 1_000)
            throw new RecordingWorkerProtocolError();
        return { type: "warning", message };
    }
    acceptTerminal(terminal) {
        this.phase = "terminal";
        this.terminal = terminal;
        return { type: "terminal" };
    }
    applyRevision(message) {
        if (message.revision !== this.current.revision + 1 ||
            message.base_revision !== this.current.revision ||
            message.replace_from_seq > this.current.segments.length ||
            message.audio_through_ms < this.current.audioThroughMs)
            throw new RecordingWorkerProtocolError();
        const prefix = this.current.segments.slice(0, message.replace_from_seq);
        const segments = [...prefix, ...message.segments.map(draftSegment)];
        if (segments.length > MAX_SEGMENTS)
            throw new RecordingWorkerProtocolError();
        let previousStart = -1;
        let previousEnd = -1;
        for (const segment of segments) {
            if (segment.startMs < previousStart ||
                (segment.startMs === previousStart && segment.endMs < previousEnd))
                throw new RecordingWorkerProtocolError();
            previousStart = segment.startMs;
            previousEnd = segment.endMs;
        }
        return {
            revision: message.revision,
            audioThroughMs: message.audio_through_ms,
            generatedAtMs: message.generated_at_ms,
            segments,
        };
    }
}
//# sourceMappingURL=worker-host-state.js.map