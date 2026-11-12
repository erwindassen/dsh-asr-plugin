import type { Readable, Writable } from "node:stream";
import type { RecordingFinalizeMessage, RecordingFinalResultPayload, RecordingRevisionMessage, RecordingWarningMessage } from "./worker-types.js";
export interface RecordingDraftLoopOptions {
    readonly signal: AbortSignal;
    publishRevision(message: RecordingRevisionMessage): Promise<void>;
    publishWarning(message: RecordingWarningMessage): Promise<void>;
}
export interface LoadedRecordingWorkerRuntime {
    readonly engineFingerprint: string;
    runDrafts(options: RecordingDraftLoopOptions): Promise<void>;
    finalize(message: RecordingFinalizeMessage): Promise<RecordingFinalResultPayload>;
    close(): Promise<void>;
}
export interface RecordingWorkerServerOptions {
    readonly input: Readable;
    readonly output: Writable;
    readonly diagnostics: Writable;
    load(): Promise<LoadedRecordingWorkerRuntime>;
}
export declare function runRecordingWorkerServer(options: RecordingWorkerServerOptions): Promise<0 | 1>;
