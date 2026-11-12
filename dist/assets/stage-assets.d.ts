import type { AssetRuntime } from "./verify-assets.js";
export interface StageAssetsOptions {
    assetRoot: string;
    manifestPath: string;
    runtime?: AssetRuntime;
    sources: Readonly<Record<string, string>>;
}
export declare function stageAssets(options: StageAssetsOptions): Promise<Record<string, string>>;
