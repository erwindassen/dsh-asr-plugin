import type { AssetRecord, AssetRuntime } from "./verify-assets.js";
export declare function currentRuntime(): AssetRuntime;
export declare function inspectRegularFile(path: string, signal?: AbortSignal): Promise<{
    byteLength: number;
    sha256: string;
}>;
export declare function verifyAssetAtRoot(root: string, asset: AssetRecord, runtime: AssetRuntime, signal?: AbortSignal): Promise<void>;
