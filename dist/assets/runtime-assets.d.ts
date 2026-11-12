import type { AsrEngine, ProcessingIdentity, ProcessingMode } from "./processing-identity.js";
import type { DoctorReport } from "./runtime-assets-doctor.js";
export type { DoctorCheck, DoctorHashStatus, DoctorIssue, DoctorReport, } from "./runtime-assets-doctor.js";
export interface RuntimeAssetsInput {
    readonly signal?: AbortSignal;
    readonly mode?: ProcessingMode;
    readonly engine?: AsrEngine;
    readonly dataRoot: string;
    readonly packageRoot: string;
}
export interface StageModelPackInput extends RuntimeAssetsInput {
    readonly modelPackPath: string;
}
export interface StageResult {
    readonly installed: boolean;
    readonly modelSetFingerprint: string;
}
export interface ResolvedRuntimeAssets {
    readonly processing?: {
        readonly identity: ProcessingIdentity;
        readonly punctuationRoot: string | null;
    };
    readonly engineFingerprint: string;
    readonly manifestPath: string;
    readonly modelRoot: string;
    readonly modelSetFingerprint: string;
    readonly packagedNativeRoot: string;
}
export declare function stageModelPack(input: StageModelPackInput): Promise<StageResult>;
export declare function resolveRuntimeAssets(input: RuntimeAssetsInput): Promise<ResolvedRuntimeAssets>;
export declare function resolveConfiguredRuntimeAssets(input: RuntimeAssetsInput, _legacyPreference?: boolean): Promise<ResolvedRuntimeAssets>;
export declare function doctorRuntimeAssets(input: RuntimeAssetsInput): Promise<DoctorReport>;
export { doctorRecordingHelper, packagedRecordingHelperLayout, verifyRecordingHelperAssets, } from "./recording-helper-assets.js";
export type { RecordingHelperAssetsInput, RecordingHelperDoctorReport, RecordingHelperSignatureFacts, RecordingHelperSignatureInspectionInput, RecordingHelperSignatureInspector, VerifiedRecordingHelper, } from "./recording-helper-assets.js";
