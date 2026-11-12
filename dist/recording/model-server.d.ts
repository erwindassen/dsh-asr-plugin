import { type Readable, type Writable } from "node:stream";
import { type LoadedRecordingWorkerRuntime } from "./worker-server.js";
export interface LoadedRecordingModels {
    readonly engineFingerprint: string;
    createSession(meetingId: string, runId: string): Promise<LoadedRecordingWorkerRuntime>;
    close(): Promise<void>;
}
interface ModelServerOptions {
    readonly input: Readable;
    readonly output: Writable;
    readonly diagnostics: Writable;
    load(): Promise<LoadedRecordingModels>;
}
export declare function runRecordingModelServer(options: ModelServerOptions): Promise<0 | 1>;
export {};
