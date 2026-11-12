import type { Readable, Writable } from "node:stream";
export declare const MAX_FRAME_PAYLOAD_BYTES: number;
export type FrameProtocolErrorCode = "INVALID_FRAME_LENGTH" | "INVALID_JSON" | "INVALID_JSON_ROOT" | "INVALID_UTF8" | "TRUNCATED_FRAME";
export declare class FrameProtocolError extends Error {
    readonly code: FrameProtocolErrorCode;
    constructor(code: FrameProtocolErrorCode, message: string, options?: ErrorOptions);
}
export declare function encodeFrame(value: object): Buffer;
export declare function decodeFrames(stream: Readable): AsyncGenerator<Record<string, unknown>>;
export declare function writeFrame(stream: Writable, value: object): Promise<number>;
