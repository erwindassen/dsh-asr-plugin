import type { AssetRecord } from "./verify-assets.js";
import type { ModelDownloadPack } from "./model-download-contract.js";
export declare function prepareDownloadCache(dataRoot: string, pack: ModelDownloadPack): Promise<string>;
export declare function restoreDownloadedAsset(root: string, manifestPath: string, asset: AssetRecord, destination: string, signal: AbortSignal): Promise<boolean>;
export declare function retainDownloadedAsset(root: string, asset: AssetRecord, source: string): Promise<void>;
