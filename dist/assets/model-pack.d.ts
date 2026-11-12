import type { AssetManifest, AssetRecord } from "./verify-assets.js";
export interface ModelPackMaterial {
    readonly byteLength: number;
    readonly relativePath: string;
    readonly sha256: string;
}
export type ModelPackKind = "base" | "parakeet" | "punctuation";
interface ModelPackContents {
    readonly assets: AssetRecord[];
    readonly materials: ModelPackMaterial[];
    readonly modelSetFingerprint: string;
}
export type ModelPackManifest = ModelPackContents & ({
    readonly schemaVersion: 1;
} | {
    readonly schemaVersion: 2;
    readonly packKind: ModelPackKind;
    readonly compatibilityFingerprint: string;
});
export declare function isPunctuationAsset(asset: Pick<AssetRecord, "id">): boolean;
export declare function isParakeetAsset(asset: Pick<AssetRecord, "id">): boolean;
export declare function isSharedAsset(asset: Pick<AssetRecord, "id">): boolean;
export declare function modelPackAssets(manifest: AssetManifest, pack?: ModelPackKind): AssetRecord[];
export declare function modelPackFingerprint(manifest: AssetManifest, pack?: ModelPackKind): string;
export declare function modelSetFingerprint(manifest: AssetManifest): string;
export declare function parseModelPackManifest(bytes: Buffer, runtime: AssetManifest): ModelPackManifest;
export {};
