import type { WorkerProgressMessage, WorkerResultMessage, WorkerRunMessage } from "./types.js";
import type { AsrResultMessage, AsrRunMessage, DiarizationResultMessage } from "./types.js";
import type { WorkerReadyMessage } from "./types.js";
import type { WorkerRunOptions } from "./worker-client.js";
export interface WorkerRunner {
    run(run: WorkerRunMessage, options?: WorkerRunOptions): Promise<WorkerResultMessage>;
}
export interface WorkerPipelineOptions {
    readonly asr: WorkerRunner;
    readonly diarization: WorkerRunner;
    readonly asrRun: AsrRunMessage;
    readonly diarizationRequestId: string;
    readonly signal?: AbortSignal;
    readonly onProgress?: (kind: "asr" | "diarization", message: WorkerProgressMessage) => void;
    readonly onReady?: (kind: "asr" | "diarization", message: WorkerReadyMessage) => void;
    readonly onHandoff?: () => void;
}
export type WorkerPipelineResult = {
    readonly type: "empty";
    readonly asr: AsrResultMessage;
} | {
    readonly type: "diarized";
    readonly asr: AsrResultMessage;
    readonly diarization: DiarizationResultMessage;
};
export declare function runWorkerPipeline(options: WorkerPipelineOptions): Promise<WorkerPipelineResult>;
