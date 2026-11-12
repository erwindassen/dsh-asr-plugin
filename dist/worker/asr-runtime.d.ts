import type { AsrEngine, ProcessingMode } from "../assets/processing-identity.js";
import type { WorkerEntryConfig } from "./entry-config.js";
import type { LoadedWorkerRuntime } from "./worker-server.js";
export declare function asrAssetIds(engine: AsrEngine, mode: ProcessingMode): readonly string[];
export declare function loadAsrWorkerRuntime(config: WorkerEntryConfig): Promise<LoadedWorkerRuntime<"asr">>;
