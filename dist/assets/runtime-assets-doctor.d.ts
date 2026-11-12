import type { ModelPackKind } from "./model-pack.js";
import type { AssetManifest, AssetRecord, AssetRuntime } from "./verify-assets.js";
export type DoctorHashStatus = "hash_mismatch" | "missing" | "not_checked" | "ok" | "size_mismatch";
export interface DoctorCheck {
    readonly hashStatus: DoctorHashStatus;
    readonly id: string;
    readonly kind: AssetRecord["kind"] | "dependency" | "package";
    readonly status: "error" | "ok";
    readonly version?: string;
}
export interface DoctorIssue {
    readonly action: "reinstall_dependency" | "reinstall_plugin" | "restage_model_pack" | "use_compatible_runtime";
    readonly code: string;
    readonly id: string;
}
export interface DoctorReport {
    readonly checks: DoctorCheck[];
    readonly engineFingerprint: string;
    readonly issues: DoctorIssue[];
    readonly modelSetFingerprint: string;
    readonly ready: boolean;
    readonly enhancedReady: boolean;
    readonly groups: Record<ModelPackKind | "native", DoctorGroup>;
    readonly runtime: AssetRuntime;
}
export interface DoctorGroup {
    readonly checks: DoctorCheck[];
    readonly issues: DoctorIssue[];
    ready: boolean;
}
export interface DoctorRuntimeLayout {
    readonly engineFingerprint: string;
    readonly manifest: AssetManifest;
    readonly manifestPath: string;
    readonly modelRoot: string;
    readonly modelSetFingerprint: string;
    readonly packagedNativeRoot: string;
}
export declare function doctorResolvedRuntimeAssets(input: {
    readonly packageRoot: string;
}, layout: DoctorRuntimeLayout): Promise<DoctorReport>;
