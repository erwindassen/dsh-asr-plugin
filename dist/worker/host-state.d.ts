import type { WorkerProcessOutcome } from "./process.js";
import type { WorkerErrorMessage, WorkerProgressMessage, WorkerResultMessage, WorkerRunMessage, WorkerToHostMessage } from "./types.js";
export type WorkerHostEvent = {
    readonly type: "send_run";
} | {
    readonly type: "progress";
    readonly message: WorkerProgressMessage;
} | {
    readonly type: "terminal";
};
export type WorkerTerminal = {
    readonly type: "result";
    readonly message: WorkerResultMessage;
} | {
    readonly type: "error";
    readonly message: WorkerErrorMessage;
};
export declare class WorkerProtocolError extends Error {
    readonly code: "WORKER_PROTOCOL_ERROR";
    constructor(message?: string);
}
interface WorkerHostStateOptions {
    readonly expectedFingerprint: string;
    readonly run: WorkerRunMessage;
}
export declare class WorkerHostState {
    private readonly options;
    private phase;
    private progressCount;
    private terminal;
    constructor(options: WorkerHostStateOptions);
    receive(message: WorkerToHostMessage): WorkerHostEvent;
    private receiveBeforeReady;
    private acceptReady;
    private receiveWhileRunning;
    private acceptProgress;
    private acceptTerminal;
    finish(outcome: WorkerProcessOutcome): WorkerTerminal;
}
export {};
