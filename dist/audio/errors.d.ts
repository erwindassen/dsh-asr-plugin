export type AudioReadErrorReason = "AUDIO_TOO_LONG" | "INVALID_HEADER" | "IO_FAILURE" | "RANGE_INVALID" | "UNSUPPORTED_FORMAT";
export declare class AudioReadError extends Error {
    readonly code = "AUDIO_READ_FAILED";
    readonly reason: AudioReadErrorReason;
    constructor(reason: AudioReadErrorReason, message: string, options?: ErrorOptions);
}
