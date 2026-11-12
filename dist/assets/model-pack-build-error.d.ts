export type ModelPackBuildErrorCode = "MODEL_PACK_BUILD_INVALID" | "MODEL_PACK_OUTPUT_EXISTS";
export declare class ModelPackBuildError extends Error {
    readonly code: ModelPackBuildErrorCode;
    constructor(code: ModelPackBuildErrorCode, message: string);
}
export declare function failModelPackBuildInvalid(message: string): never;
export declare function fileSystemErrorCode(error: unknown): unknown;
