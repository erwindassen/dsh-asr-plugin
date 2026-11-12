export type MeetingRepositoryErrorCode = "INVALID_INPUT" | "MEETING_NOT_FOUND" | "ENGINE_BUSY" | "INVALID_MEETING_STATE" | "TRANSCRIPT_VERSION_CONFLICT" | "RUN_STATE_CONFLICT" | "DELETE_INCOMPLETE" | "DATA_ROOT_IN_USE" | "SCHEMA_VERSION_UNSUPPORTED" | "DATABASE_INTEGRITY_FAILED" | "STORAGE_FAILURE";
export declare class MeetingRepositoryError extends Error {
    readonly code: MeetingRepositoryErrorCode;
    constructor(code: MeetingRepositoryErrorCode, message: string, options?: ErrorOptions);
}
