import { type Pcm16WavMetadata, type Pcm16WavReader } from "./wav-reader.js";
import { type RecordingChunkReader, type RecordingTimeline } from "./recording-timeline.js";
export declare class RecordingTimelineChangedError extends Error {
    readonly code: "INVALID_RECORDING_TIMELINE";
    constructor(message: string);
}
export declare class RecordingTimelineReader implements Pcm16WavReader {
    private timeline;
    private readonly readChunk;
    private closed;
    private reading;
    constructor(timeline: RecordingTimeline, readChunk: RecordingChunkReader);
    get metadata(): Pcm16WavMetadata;
    update(timeline: RecordingTimeline, immutableThroughFrame?: number): void;
    close(): Promise<void>;
    readFrames(startFrame: number, endFrame: number): Promise<Float32Array>;
    readFramesInto(startFrame: number, endFrame: number, target: Float32Array, targetOffset?: number): Promise<void>;
}
