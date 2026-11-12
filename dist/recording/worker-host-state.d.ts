import type { DraftTranscriptSnapshot, RecordingFinalizeMessage, RecordingFinalResultMessage, RecordingWarningMessage, RecordingWorkerErrorMessage, RecordingWorkerToHostMessage } from "./worker-types.js";
import type { WorkerProcessOutcome } from "../worker/process.js";
export declare class RecordingWorkerProtocolError extends Error {
    readonly code: "WORKER_PROTOCOL_ERROR";
    constructor();
}
interface RecordingWorkerHostStateOptions {
    readonly expectedFingerprint: string;
}
export type RecordingWorkerHostEvent = {
    readonly type: "ready";
} | {
    readonly type: "revision";
    readonly snapshot: DraftTranscriptSnapshot;
} | {
    readonly type: "warning";
    readonly message: RecordingWarningMessage;
} | {
    readonly type: "terminal";
};
export type RecordingWorkerTerminal = {
    readonly type: "result";
    readonly message: RecordingFinalResultMessage;
} | {
    readonly type: "error";
    readonly message: RecordingWorkerErrorMessage;
};
export declare class RecordingWorkerHostState {
    private readonly options;
    private phase;
    private finalize;
    private terminal;
    private warningCount;
    private current;
    constructor(options: RecordingWorkerHostStateOptions);
    receive(message: RecordingWorkerToHostMessage): RecordingWorkerHostEvent;
    snapshot(): DraftTranscriptSnapshot;
    beginFinalize(message: RecordingFinalizeMessage): RecordingFinalizeMessage;
    finish(outcome: WorkerProcessOutcome): RecordingWorkerTerminal;
    private receiveBeforeReady;
    private receiveWhileRecording;
    private receiveWhileFinalizing;
    private acceptWarning;
    private acceptTerminal;
    private applyRevision;
}
export {};
