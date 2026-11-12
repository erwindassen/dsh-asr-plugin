import type { Readable, Writable } from "node:stream";
import type { AsrResultPayload, AsrRunMessage, DiarizationResultPayload, DiarizationRunMessage, WorkerKind, WorkerProgressStage } from "./types.js";
type RunFor<K extends WorkerKind> = K extends "asr" ? AsrRunMessage : DiarizationRunMessage;
type PayloadFor<K extends WorkerKind> = K extends "asr" ? AsrResultPayload : DiarizationResultPayload;
export interface LoadedWorkerRuntime<K extends WorkerKind> {
    readonly engineFingerprint: string;
    execute(run: RunFor<K>, report: (stage: WorkerProgressStage, ratio: number) => Promise<void>): Promise<PayloadFor<K>>;
    close(): Promise<void>;
}
export interface WorkerServerOptions<K extends WorkerKind> {
    readonly kind: K;
    readonly input: Readable;
    readonly output: Writable;
    readonly diagnostics: Writable;
    load(): Promise<LoadedWorkerRuntime<K>>;
}
export declare function runWorkerServer<K extends WorkerKind>(options: WorkerServerOptions<K>): Promise<0 | 1>;
export {};
