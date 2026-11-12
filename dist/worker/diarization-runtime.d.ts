import type { WorkerEntryConfig } from "./entry-config.js";
import type { LoadedWorkerRuntime } from "./worker-server.js";
export declare function loadDiarizationWorkerRuntime(config: WorkerEntryConfig): Promise<LoadedWorkerRuntime<"diarization">>;
