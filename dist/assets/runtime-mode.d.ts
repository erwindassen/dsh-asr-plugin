import type { AsrEngine, ProcessingMode } from "./processing-identity.js";
import type { DoctorRuntimeLayout } from "./runtime-assets-doctor.js";
import type { ModelPackKind } from "./model-pack.js";
export declare function selectedModelRoot(layout: Pick<DoctorRuntimeLayout, "manifest" | "modelRoot">, modelStoreRoot: string, pack: ModelPackKind): Promise<string>;
export declare function resolveProcessingAssets(layout: DoctorRuntimeLayout & {
    modelStoreRoot: string;
}, mode: ProcessingMode, engine?: AsrEngine, signal?: AbortSignal): Promise<{
    engineFingerprint: string;
    modelRoot: string;
    processing: Readonly<{
        identity: import("./processing-identity-types.js").ProcessingIdentity;
        punctuationRoot: string | null;
    }>;
}>;
export declare function configuredProcessingMode(layout: Pick<DoctorRuntimeLayout, "modelRoot" | "manifest"> & {
    modelStoreRoot: string;
}, engine?: AsrEngine, signal?: AbortSignal): Promise<ProcessingMode>;
