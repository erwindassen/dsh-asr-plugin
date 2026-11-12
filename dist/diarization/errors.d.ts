export type DiarizationErrorCode = "ASSET_MISMATCH" | "INPUT_INVALID" | "MODEL_INFERENCE_FAILED" | "MODEL_LOAD_FAILED" | "NATIVE_LOAD_FAILED" | "NATIVE_FAILURE" | "RESOURCE_LIMIT";
export declare class DiarizationError extends Error {
    readonly code: DiarizationErrorCode;
    constructor(code: DiarizationErrorCode, message: string, options?: ErrorOptions);
}
