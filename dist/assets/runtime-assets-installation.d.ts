import type { AssetManifest } from "./verify-assets.js";
export interface ModelInstallationLayout {
    readonly manifest: AssetManifest;
    readonly modelRoot: string;
    readonly modelStoreRoot: string;
}
export type InstallationState = "absent" | "damaged" | "ready";
export declare function verifyModelsAtRoot(manifest: AssetManifest, modelRoot: string, signal?: AbortSignal): Promise<void>;
export declare function installationState(layout: Pick<ModelInstallationLayout, "manifest" | "modelRoot">, signal?: AbortSignal): Promise<InstallationState>;
export declare function installVerifiedModels(layout: ModelInstallationLayout, temporaryRoot: string, previousState: InstallationState): Promise<boolean>;
export declare function prepareModelStore(layout: ModelInstallationLayout): Promise<void>;
export declare function reconcileStaleStageEntries(modelStoreRoot: string): Promise<void>;
