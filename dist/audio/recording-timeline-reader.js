import { MAX_PCM_RANGE_FRAMES, PCM_SAMPLE_RATE, } from "./wav-reader.js";
import { renderRecordingWindow, } from "./recording-timeline.js";
export class RecordingTimelineChangedError extends Error {
    code = "INVALID_RECORDING_TIMELINE";
    constructor(message) {
        super(message);
        this.name = "RecordingTimelineChangedError";
    }
}
function invalid(message) {
    throw new RecordingTimelineChangedError(message);
}
function assertRange(start, end, frameCount) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || end < start || end > frameCount || end - start > MAX_PCM_RANGE_FRAMES)
        invalid("Recording timeline PCM range is invalid");
}
export class RecordingTimelineReader {
    timeline;
    readChunk;
    closed = false;
    reading = false;
    constructor(timeline, readChunk) {
        this.timeline = timeline;
        this.readChunk = readChunk;
    }
    get metadata() {
        const frameCount = this.timeline.frameCount;
        return {
            bitDepth: 16,
            channels: 1,
            dataByteLength: frameCount * 2,
            dataOffset: 44,
            durationMs: Math.ceil((frameCount * 1_000) / PCM_SAMPLE_RATE),
            frameCount,
            sampleRate: PCM_SAMPLE_RATE,
        };
    }
    update(timeline, immutableThroughFrame = this.timeline.frameCount) {
        if (this.closed)
            invalid("Recording timeline reader is closed");
        if (!Number.isSafeInteger(immutableThroughFrame) || immutableThroughFrame < 0 ||
            immutableThroughFrame > this.timeline.frameCount)
            invalid("Recording timeline watermark is invalid");
        if (timeline.originUs !== this.timeline.originUs)
            invalid("Recording timeline origin changed");
        if (timeline.frameCount < this.timeline.frameCount)
            invalid("Recording timeline became shorter");
        const known = new Set(this.timeline.chunks.map((chunk) => chunk.id));
        if (timeline.chunks.some((chunk) => !known.has(chunk.id) && chunk.startFrame < immutableThroughFrame)) {
            invalid("Recording timeline history changed");
        }
        this.timeline = timeline;
    }
    async close() {
        this.closed = true;
    }
    async readFrames(startFrame, endFrame) {
        const output = new Float32Array(endFrame - startFrame);
        await this.readFramesInto(startFrame, endFrame, output);
        return output;
    }
    async readFramesInto(startFrame, endFrame, target, targetOffset = 0) {
        assertRange(startFrame, endFrame, this.timeline.frameCount);
        if (!(target instanceof Float32Array) || !Number.isSafeInteger(targetOffset) ||
            targetOffset < 0 || targetOffset + endFrame - startFrame > target.length)
            invalid("Recording timeline PCM target is invalid");
        if (this.closed || this.reading)
            invalid("Recording timeline reader is unavailable");
        if (startFrame === endFrame)
            return;
        this.reading = true;
        try {
            target.set(await renderRecordingWindow(this.timeline, startFrame, endFrame, this.readChunk), targetOffset);
        }
        finally {
            this.reading = false;
        }
    }
}
//# sourceMappingURL=recording-timeline-reader.js.map