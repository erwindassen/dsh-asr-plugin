import type { ModelPackKind } from "./model-pack.js";
export { ModelPackBuildError } from "./model-pack-build-error.js";
export type { ModelPackBuildErrorCode } from "./model-pack-build-error.js";
export interface BuildModelPackInput {
    readonly pack?: ModelPackKind;
    readonly modelRoot: string;
    readonly outputPath: string;
    readonly packageRoot: string;
    readonly signal?: AbortSignal;
}
export interface BuildModelPackResult {
    readonly archiveByteLength: number;
    readonly archiveSha256: string;
    readonly assetCount: number;
    readonly modelBytes: number;
    readonly modelSetFingerprint: string;
}
export declare function buildModelPack(input: BuildModelPackInput): Promise<BuildModelPackResult>;
