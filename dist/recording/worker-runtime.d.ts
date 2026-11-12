import type { AsrEngine, ProcessingMode } from "../assets/processing-identity.js";
import type { RecordingWorkerEntryConfig } from "./entry-config.js";
import type { LoadedRecordingWorkerRuntime } from "./worker-server.js";
export declare function recordingAssetIds(engine: AsrEngine, mode: ProcessingMode): readonly string[];
export declare function loadRecordingModels(config: RecordingWorkerEntryConfig): Promise<import("./model-server.js").LoadedRecordingModels>;
export declare function loadRecordingWorkerRuntime(config: RecordingWorkerEntryConfig): Promise<LoadedRecordingWorkerRuntime>;
