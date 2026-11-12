import type { WorkerEntryConfig } from "./entry-config.js";
export interface VerifiedWorkerAssets {
    readonly engineFingerprint: string;
    readonly paths: Readonly<Record<string, string>>;
}
export declare function loadWorkerAssets(config: WorkerEntryConfig, requiredIds: readonly string[]): Promise<VerifiedWorkerAssets>;
export declare function requiredAsset(assets: Readonly<Record<string, string>>, id: string): string;
