import type { JobRegistry } from "@deepseek-ai/dsh-jobs";
import type { ModelDownloadControl, ModelDownloadPack, ModelDownloadSettings, ModelDownloadStatus } from "./model-download-contract.js";
import type { ModelDownloadTransport } from "./model-download-transport.js";
declare module "@deepseek-ai/dsh-jobs" {
    interface JobKindMap {
        "asr-model-download": "asr-model-download";
    }
}
interface Input {
    readonly dataRoot: string;
    readonly packageRoot: string;
    readonly transport: ModelDownloadTransport;
    readonly jobs: Pick<JobRegistry, "start">;
    readonly settings: () => ModelDownloadSettings;
}
export declare class ModelDownloadController implements ModelDownloadControl {
    private readonly input;
    private view;
    private active;
    private disposed;
    constructor(input: Input);
    status(): ModelDownloadStatus;
    start(pack: ModelDownloadPack): Promise<ModelDownloadStatus>;
    cancel(): Promise<ModelDownloadStatus>;
    dispose(): Promise<void>;
    private run;
}
export {};
