import { type RecordingTimeline, type RecordingTimelineChunk } from "./recording-timeline.js";
export declare class ClosedRecordingChunkError extends Error {
    readonly code: "AUDIO_READ_FAILED";
    constructor(message: string, options?: ErrorOptions);
}
export interface ClosedRecordingChunks {
    scan(): Promise<RecordingTimeline | null>;
    read(chunk: RecordingTimelineChunk, startFrame: number, endFrame: number): Promise<Float32Array>;
}
export declare function openClosedRecordingChunks(recordingDirectory: string): Promise<ClosedRecordingChunks>;
