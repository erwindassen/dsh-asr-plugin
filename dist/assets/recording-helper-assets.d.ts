import type { RecordingHelperAssetErrorCode } from "./recording-helper-asset-error.js";
import { RECORDING_HELPER_BUNDLE_IDENTIFIER } from "./recording-helper-manifest.js";
import type { RecordingHelperSigningMode } from "./recording-helper-manifest.js";
export { RecordingHelperAssetError } from "./recording-helper-asset-error.js";
export type { RecordingHelperAssetErrorCode } from "./recording-helper-asset-error.js";
export type { RecordingHelperSigningMode } from "./recording-helper-manifest.js";
export interface RecordingHelperCodeSignatureFacts {
    readonly adHoc: boolean;
    readonly entitlements: readonly string[];
    readonly hardenedRuntime: boolean;
    readonly relativePath: string;
    readonly signingIdentity: string | null;
    readonly teamIdentifier: string | null;
    readonly valid: boolean;
}
export interface RecordingHelperSignatureFacts {
    readonly app: {
        readonly adHoc: boolean;
        readonly bundleIdentifier: string | null;
        readonly designatedRequirement: string | null;
        readonly entitlements: readonly string[];
        readonly hardenedRuntime: boolean;
        readonly signingIdentity: string | null;
        readonly teamIdentifier: string | null;
        readonly valid: boolean;
    };
    readonly components: readonly RecordingHelperCodeSignatureFacts[];
    readonly deepValid: boolean;
}
export interface RecordingHelperSignatureInspectionInput {
    readonly appRoot: string;
    readonly componentPaths: readonly string[];
}
export type RecordingHelperSignatureInspector = (input: RecordingHelperSignatureInspectionInput) => Promise<RecordingHelperSignatureFacts>;
export interface RecordingHelperAssetsInput {
    readonly appRoot: string;
    readonly inspectSignature: RecordingHelperSignatureInspector;
    readonly manifestPath: string;
}
export interface VerifiedRecordingHelper {
    readonly appRoot: string;
    readonly bundleIdentifier: typeof RECORDING_HELPER_BUNDLE_IDENTIFIER;
    readonly componentPaths: readonly string[];
    readonly manifestSha256: string;
    readonly signingMode: RecordingHelperSigningMode;
    readonly teamIdentifier: string | null;
}
export interface RecordingHelperDoctorCheck {
    readonly hashStatus: "hash_mismatch" | "not_checked" | "ok";
    readonly id: "recording-helper-app-tree" | "recording-helper-signature";
    readonly status: "error" | "ok";
}
export interface RecordingHelperDoctorIssue {
    readonly action: "rebuild_or_reinstall_helper" | "use_compatible_runtime";
    readonly code: RecordingHelperAssetErrorCode;
    readonly id: RecordingHelperDoctorCheck["id"];
}
export interface RecordingHelperDoctorReport {
    readonly checks: readonly RecordingHelperDoctorCheck[];
    readonly issues: readonly RecordingHelperDoctorIssue[];
    readonly ready: boolean;
    readonly signingMode: RecordingHelperSigningMode | null;
}
export declare function verifyRecordingHelperAssets(input: RecordingHelperAssetsInput): Promise<VerifiedRecordingHelper>;
export declare function doctorRecordingHelper(input: RecordingHelperAssetsInput): Promise<RecordingHelperDoctorReport>;
export declare function packagedRecordingHelperLayout(packageRoot: string): {
    readonly appRoot: string;
    readonly manifestPath: string;
};
