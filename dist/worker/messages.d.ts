import type { WorkerKind, WorkerRunMessage, WorkerToHostMessage } from "./types.js";
declare const MAX_PROGRESS_MESSAGES = 1000;
export declare const MAX_TOTAL_TEXT_WIRE_BYTES: number;
export declare class WorkerSchemaError extends Error {
    readonly code: "SCHEMA_VIOLATION";
    constructor(message?: string);
}
export declare function parseRunMessage(value: unknown, expectedKind: WorkerKind): WorkerRunMessage;
export declare function parseWorkerMessage(value: unknown, expectedKind: WorkerKind): WorkerToHostMessage;
export { MAX_PROGRESS_MESSAGES };
