import type { ResolvedRuntimeAssets } from "../assets/runtime-assets.js";
import type { WorkerSpawner } from "../worker/process.js";
import type { RecordingSessionWorkerFactory } from "./recording-session.js";
interface RecordingModelWorkerOptions {
    readonly spawner: WorkerSpawner;
    readonly meetingsRoot: string;
    readonly workRoot: string;
    readonly idleTimeoutMs?: number;
    readonly readyTimeoutMs?: number;
}
export declare class RecordingModelWorker {
    private readonly options;
    private entry;
    private timer;
    private closed;
    private selecting;
    private retiring;
    constructor(options: RecordingModelWorkerOptions);
    prepare(assets: ResolvedRuntimeAssets, signal?: AbortSignal): Promise<void>;
    factory(assets: ResolvedRuntimeAssets): RecordingSessionWorkerFactory;
    releaseIdle(): Promise<void>;
    dispose(): Promise<void>;
    private launch;
    private ensure;
    private select;
    private create;
    private armIdle;
    private release;
}
export {};
