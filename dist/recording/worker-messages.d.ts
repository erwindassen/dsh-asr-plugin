import type { RecordingFinalizeMessage, RecordingWorkerToHostMessage } from "./worker-types.js";
export declare class RecordingWorkerSchemaError extends Error {
    readonly code: "SCHEMA_VIOLATION";
    constructor();
}
export declare function parseRecordingFinalizeMessage(value: unknown): RecordingFinalizeMessage;
export declare function parseRecordingWorkerMessage(value: unknown): RecordingWorkerToHostMessage;
