import type { ModelDownloadSettings } from "./model-download-contract.js";
import type { SupplyChainAsset } from "./supply-chain.js";
export interface ModelDownloadSource {
    readonly url: string;
    readonly proxyUrl?: string;
}
export declare function modelDownloadSources(source: SupplyChainAsset, settings: ModelDownloadSettings): ModelDownloadSource[];
