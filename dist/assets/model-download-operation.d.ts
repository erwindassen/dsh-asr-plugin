import type { ModelDownloadPack, ModelDownloadSettings, ModelDownloadStatus } from "./model-download-contract.js";
import type { ModelDownloadTransport } from "./model-download-transport.js";
export interface ModelDownloadOperationInput {
    readonly dataRoot: string;
    readonly packageRoot: string;
    readonly pack: ModelDownloadPack;
    readonly settings: ModelDownloadSettings;
    readonly transport: ModelDownloadTransport;
    readonly signal: AbortSignal;
    readonly update: (value: Partial<ModelDownloadStatus>) => void;
}
export declare function installDownloadedModels(input: ModelDownloadOperationInput): Promise<void>;
