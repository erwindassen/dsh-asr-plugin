export declare const MAX_RECORDING_CHUNKS_PER_TRACK = 4096;
export type RecordingTrack = "mic" | "system";
export interface RecordingChunk {
    readonly id: string;
    readonly track: RecordingTrack;
    readonly startUs: number;
    readonly endUs: number;
    readonly frameCount: number;
}
export interface RecordingTimelineChunk extends RecordingChunk {
    readonly startFrame: number;
    readonly endFrame: number;
}
export interface RecordingTimeline {
    readonly originUs: number;
    readonly frameCount: number;
    readonly chunks: readonly RecordingTimelineChunk[];
}
export type RecordingChunkReader = (chunk: RecordingTimelineChunk, startFrame: number, endFrame: number) => Promise<Float32Array>;
export declare class RecordingTimelineError extends Error {
    readonly code: "INVALID_RECORDING_TIMELINE";
    constructor(message: string);
}
export declare function buildRecordingTimeline(input: readonly RecordingChunk[]): RecordingTimeline;
export declare function renderRecordingWindow(timeline: RecordingTimeline, startFrame: number, endFrame: number, read: RecordingChunkReader): Promise<Float32Array>;
export declare function renderRecordingTrackWindow(timeline: RecordingTimeline, track: RecordingTrack, startFrame: number, endFrame: number, read: RecordingChunkReader): Promise<Float32Array>;
