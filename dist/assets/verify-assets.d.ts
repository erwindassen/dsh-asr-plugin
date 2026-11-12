export interface AssetRecord {
    kind: "config" | "model" | "native" | "tokens";
    id: string;
    relativePath: string;
    byteLength: number;
    sha256: string;
    runtime?: AssetRuntime;
}
export interface AssetManifest {
    algorithmRevision: string;
    schemaVersion: 2;
    assets: AssetRecord[];
}
export interface VerifyAssetsOptions {
    assetRoot: string;
    manifestPath: string;
    runtime?: AssetRuntime;
}
export interface VerifyAssetRootsOptions {
    readonly punctuationRoot?: string;
    assetIds: readonly string[];
    manifestPath: string;
    modelRoot: string;
    packagedNativeRoot: string;
    runtime?: AssetRuntime;
}
export interface AssetRuntime {
    platform: string;
    architecture: string;
    nodeMajor: number;
    napi: number;
}
export type AssetVerificationErrorCode = "ASSET_HASH_MISMATCH" | "ASSET_MISSING" | "ASSET_PATH_INVALID" | "ASSET_SIZE_MISMATCH" | "MANIFEST_INVALID" | "RUNTIME_MISMATCH" | "STAGE_SOURCE_MISSING";
export declare class AssetVerificationError extends Error {
    readonly assetId: string | undefined;
    readonly code: AssetVerificationErrorCode;
    constructor(code: AssetVerificationErrorCode, message: string, assetId?: string);
}
export declare function mapAssetPathError(error: unknown, assetId: string): AssetVerificationError | undefined;
export declare function resolveAssetPath(assetRoot: string, asset: AssetRecord): string;
export declare function assertAssetPathDirectories(assetRoot: string, asset: AssetRecord): Promise<void>;
export declare function readAssetManifest(manifestPath: string): Promise<AssetManifest>;
export declare function fingerprintAssetManifest(manifestPath: string): Promise<string>;
export declare function verifyAssets(options: VerifyAssetsOptions): Promise<Record<string, string>>;
export declare function verifyAssetsAtRoots(options: VerifyAssetRootsOptions): Promise<Record<string, string>>;
