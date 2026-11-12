export type ProcessingMode = "base" | "enhanced";
/**
 * Recognizer family that produced a transcript. Identity is engine-aware so
 * cached results and Worker launches never mix families.
 */
export type AsrEngine = "paraformer" | "parakeet";
export declare const ASR_ENGINES: readonly AsrEngine[];
export interface ProcessingIdentity {
    readonly mode: ProcessingMode;
    readonly engine: AsrEngine;
    readonly baseModelFingerprint: string;
    readonly punctuationModelFingerprint: string | null;
    readonly compatibilityFingerprint: string;
    readonly engineFingerprint: string;
}
