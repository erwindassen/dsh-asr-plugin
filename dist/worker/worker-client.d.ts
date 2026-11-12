import type { WorkerLaunchSpec, WorkerProcessOutcome, WorkerSpawner } from "./process.js";
import type { StderrTail } from "./stderr-tail.js";
import type { WorkerErrorCode, WorkerKind, WorkerProgressMessage, WorkerReadyMessage, WorkerResultMessage, WorkerRunMessage, WorkerStage } from "./types.js";
export type WorkerClientErrorCode = WorkerErrorCode | "WORKER_CANCELLED" | "WORKER_PROCESS_ERROR" | "WORKER_PROTOCOL_ERROR" | "WORKER_TIMEOUT";
export type WorkerDeadlinePhase = "ready" | "run" | "termination";
interface WorkerClientErrorDetails {
    readonly cause?: unknown;
    readonly outcome?: WorkerProcessOutcome;
    readonly phase?: WorkerDeadlinePhase;
    readonly stage?: WorkerStage;
    readonly stderr: StderrTail;
}
export declare class WorkerClientError extends Error {
    readonly code: WorkerClientErrorCode;
    readonly outcome: WorkerProcessOutcome | undefined;
    readonly phase: WorkerDeadlinePhase | undefined;
    readonly stage: WorkerStage | undefined;
    readonly stderrTail: string;
    readonly stderrTruncated: boolean;
    constructor(code: WorkerClientErrorCode, message: string, details: WorkerClientErrorDetails);
    static cancelled(phase: WorkerDeadlinePhase): WorkerClientError;
}
export interface WorkerClientOptions {
    readonly kind: WorkerKind;
    readonly expectedFingerprint: string;
    readonly spawner: WorkerSpawner;
    readonly launch: WorkerLaunchSpec;
    readonly readyTimeoutMs: number;
    readonly runDeadlineMs: number;
    readonly terminationTimeoutMs: number;
}
export interface WorkerRunOptions {
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: WorkerProgressMessage) => void;
    readonly onReady?: (message: WorkerReadyMessage) => void;
}
export declare class WorkerClient {
    private readonly options;
    constructor(options: WorkerClientOptions);
    run(rawRun: WorkerRunMessage, runOptions?: WorkerRunOptions): Promise<WorkerResultMessage>;
    private runSpawned;
    private drive;
    private readFrames;
}
export {};
