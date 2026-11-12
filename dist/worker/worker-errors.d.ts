import type { WorkerErrorCode, WorkerKind, WorkerStage } from "./types.js";
export declare class WorkerRuntimeError extends Error {
    readonly code: WorkerErrorCode;
    readonly stage?: WorkerStage | undefined;
    constructor(code: WorkerErrorCode, message: string, stage?: WorkerStage | undefined, options?: ErrorOptions);
}
export interface SanitizedWorkerFailure {
    readonly code: WorkerErrorCode;
    readonly message: string;
    readonly stage: WorkerStage;
}
export declare function sanitizeWorkerFailure(error: unknown, kind: WorkerKind, fallbackStage: WorkerStage): SanitizedWorkerFailure;
export declare function stageWorkerFailure(error: unknown, kind: WorkerKind, stage: Exclude<WorkerStage, "initializing">): WorkerRuntimeError;
