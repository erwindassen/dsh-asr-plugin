export type NativeAdapterErrorCode = "NATIVE_EXECUTION_FAILED" | "NATIVE_INPUT_INVALID" | "NATIVE_LOAD_FAILED" | "NATIVE_OUTPUT_INVALID";
export declare class NativeAdapterError extends Error {
    readonly code: NativeAdapterErrorCode;
    readonly component: "fbank" | "hcluster";
    constructor(code: NativeAdapterErrorCode, component: "fbank" | "hcluster", message: string, options?: ErrorOptions);
}
