export type FunAsrErrorCode = "ASSET_MISMATCH" | "MODEL_INFERENCE_FAILED" | "MODEL_LOAD_FAILED" | "RESOURCE_LIMIT";
export declare class FunAsrError extends Error {
    readonly code: FunAsrErrorCode;
    constructor(code: FunAsrErrorCode, message: string, options?: ErrorOptions);
}
