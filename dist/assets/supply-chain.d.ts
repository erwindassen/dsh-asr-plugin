export type SupplyTransport = {
    kind: "canonical" | "cn-mirror" | "fallback" | "npm";
    url: string;
} | {
    kind: "user-authorized-staging" | "vendored-source";
};
interface SupplySource {
    attribution: string;
    canonicalRepository: string;
    citations: string[];
    distribution: "closed-pilot-only" | "public";
    license: string;
    licenseFiles: string[];
    revision: string;
    sourceMode: "rebuild" | "reuse";
    sourcePath: string;
    transports: SupplyTransport[];
}
export interface SupplyChainAsset extends SupplySource {
    id: string;
    buildTarget?: {
        architecture: string;
        napi: number;
        platform: string;
    };
}
interface SupplyFile {
    byteLength: number;
    path: string;
    sha256: string;
}
interface SupplyNoticeFile extends SupplyFile {
    deliveryPath: string;
}
export interface SupplyChainDependency extends SupplySource {
    id: "onnxruntime-node";
    packageName: "onnxruntime-node";
    version: "1.19.2";
    integrity: string;
    runtime: {
        addonNapi: number;
        architecture: string;
        nodeMajor: number;
        platform: string;
        verifiedNapi: number;
    };
    artifacts: SupplyFile[];
    noticeFiles: SupplyNoticeFile[];
}
export interface SupplyChainManifest {
    schemaVersion: 1;
    assets: SupplyChainAsset[];
    dependencies: [SupplyChainDependency];
}
export declare class SupplyChainError extends Error {
    readonly code = "SUPPLY_CHAIN_INVALID";
    readonly entryId: string | undefined;
    constructor(message: string, entryId?: string);
}
export declare function readSupplyChainManifest(options: {
    runtimeManifestPath: string;
    supplyChainPath: string;
}): Promise<SupplyChainManifest>;
export declare function renderThirdPartyNotices(manifest: SupplyChainManifest): string;
export {};
