export type TranscriptProjectionErrorCode = "CANCELLED_BY_USER" | "INVALID_INPUT" | "TRANSCRIPT_EMPTY" | "TRANSCRIPT_NOT_COMMITTED" | "EXPORT_PATH_INVALID" | "EXPORT_TARGET_EXISTS" | "EXPORT_PERMISSION_DENIED" | "EXPORT_WRITE_FAILED";
export declare class TranscriptProjectionError extends Error {
    readonly code: TranscriptProjectionErrorCode;
    constructor(code: TranscriptProjectionErrorCode, message: string, options?: ErrorOptions);
}
