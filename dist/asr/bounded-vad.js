import { performance } from "node:perf_hooks";
import { VadProcessingError } from "./errors.js";
import { mergeSpeechBlocks, splitSpeechRegions } from "./vad-regions.js";
export const VAD_WINDOW_SAMPLES = 160_000;
export const VAD_STEP_SAMPLES = 32_000;
export const VAD_BATCH_WINDOWS = 6;
export const VAD_OUTPUT_FRAMES = 589;
export const VAD_CLASSES = 7;
const SPEECH_THRESHOLD = 0.8;
const SPEAKER_TURN_THRESHOLD = 0.4;
const TURN_LOOKAHEAD = 8;
const ACCUMULATOR_CAPACITY = 1_024;
const MAX_RAW_BLOCKS = 20_000;
function inferenceFailure(message, cause) {
    return new VadProcessingError("MODEL_INFERENCE_FAILED", message, cause === undefined ? undefined : { cause });
}
function countWindows(frameCount) {
    if (frameCount === 0)
        return 0;
    if (frameCount <= VAD_WINDOW_SAMPLES)
        return 1;
    return Math.ceil((frameCount - VAD_WINDOW_SAMPLES) / VAD_STEP_SAMPLES) + 1;
}
function countFullWindows(frameCount) {
    if (frameCount < VAD_WINDOW_SAMPLES)
        return 0;
    return Math.floor((frameCount - VAD_WINDOW_SAMPLES) / VAD_STEP_SAMPLES) + 1;
}
function countOutputFrames(frameCount) {
    return Math.round((frameCount * VAD_OUTPUT_FRAMES) / VAD_WINDOW_SAMPLES);
}
function outputStart(windowIndex) {
    return Math.floor((windowIndex * VAD_STEP_SAMPLES * VAD_OUTPUT_FRAMES) / VAD_WINDOW_SAMPLES);
}
async function readWindowBatch(reader, inputBuffer, firstWindow, batchWindows, frameCount) {
    const input = inputBuffer.subarray(0, batchWindows * VAD_WINDOW_SAMPLES);
    input.fill(0);
    for (let index = 0; index < batchWindows; index += 1) {
        const startFrame = (firstWindow + index) * VAD_STEP_SAMPLES;
        const endFrame = Math.min(startFrame + VAD_WINDOW_SAMPLES, frameCount);
        await reader.readFramesInto(startFrame, endFrame, input, index * VAD_WINDOW_SAMPLES);
    }
    if (!input.every(Number.isFinite)) {
        throw inferenceFailure("WAV range reader returned invalid VAD samples");
    }
    return input;
}
export class StreamingBoundedVad {
    reader;
    model;
    accumulator = new FrameAccumulator();
    builder = new SpeechBlockBuilder();
    inputBuffer = new Float32Array(VAD_BATCH_WINDOWS * VAD_WINDOW_SAMPLES);
    smoother = new SpeakerTurnSmoother((frame) => this.builder.push(frame));
    started = performance.now();
    batchCount = 0;
    finished = false;
    inferenceMs = 0;
    maxBatchWindows = 0;
    nextWindow = 0;
    priorFrameCount = 0;
    constructor(reader, model) {
        this.reader = reader;
        this.model = model;
    }
    get metrics() {
        return {
            batchCount: this.batchCount,
            inferenceMs: Math.round(this.inferenceMs),
            maxBatchInputSamples: this.maxBatchWindows * VAD_WINDOW_SAMPLES,
            maxBatchWindows: this.maxBatchWindows,
            maxPendingFrames: this.accumulator.maxPendingFrames,
            vadMs: Math.round(performance.now() - this.started),
            windowCount: this.nextWindow,
        };
    }
    async advance(frameCount, final = false) {
        this.assertAdvance(frameCount);
        const target = final ? countWindows(frameCount) : countFullWindows(frameCount);
        const totalFrames = final ? countOutputFrames(frameCount) : Number.MAX_SAFE_INTEGER;
        while (this.nextWindow < target) {
            const batchWindows = Math.min(VAD_BATCH_WINDOWS, target - this.nextWindow);
            await this.processBatch(batchWindows, frameCount, totalFrames, target, final);
        }
        this.priorFrameCount = frameCount;
        if (final)
            this.finish(totalFrames);
    }
    snapshot(durationMs) {
        if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
            throw inferenceFailure("VAD snapshot duration is invalid");
        }
        const speechRegions = mergeSpeechBlocks(this.builder.blocks.map((block) => ({ ...block })), durationMs);
        return { speechRegions, asrChunks: splitSpeechRegions(speechRegions) };
    }
    assertAdvance(frameCount) {
        if (this.finished ||
            !Number.isSafeInteger(frameCount) ||
            frameCount < this.priorFrameCount ||
            frameCount > this.reader.metadata.frameCount)
            throw inferenceFailure("VAD incremental frame range is invalid");
    }
    async processBatch(batchWindows, frameCount, totalFrames, target, final) {
        const input = await readWindowBatch(this.reader, this.inputBuffer, this.nextWindow, batchWindows, frameCount);
        const inference = await inferBatch(this.model, input, batchWindows);
        this.inferenceMs += inference.elapsedMs;
        this.batchCount += 1;
        this.maxBatchWindows = Math.max(this.maxBatchWindows, batchWindows);
        for (let batchWindow = 0; batchWindow < batchWindows; batchWindow += 1) {
            const globalWindow = this.nextWindow + batchWindow;
            addWindow(this.accumulator, inference.logits, batchWindow, globalWindow, totalFrames);
            const following = globalWindow + 1;
            const drainEnd = final && following === target ? totalFrames : outputStart(following);
            this.accumulator.drainBefore(drainEnd, (frame) => this.smoother.push(frame));
        }
        this.nextWindow += batchWindows;
    }
    finish(totalFrames) {
        this.accumulator.drainBefore(totalFrames, (frame) => this.smoother.push(frame));
        this.smoother.finish();
        this.builder.finish();
        this.finished = true;
    }
}
function assertLogits(logits, batchWindows) {
    const expected = batchWindows * VAD_OUTPUT_FRAMES * VAD_CLASSES;
    if (!(logits instanceof Float32Array) || logits.length !== expected) {
        throw inferenceFailure("VAD model returned an invalid output shape");
    }
    if (!logits.every(Number.isFinite)) {
        throw inferenceFailure("VAD model returned non-finite logits");
    }
}
async function inferBatch(model, input, batchWindows) {
    const started = performance.now();
    try {
        const logits = await model.infer(input, batchWindows);
        assertLogits(logits, batchWindows);
        return { elapsedMs: performance.now() - started, logits };
    }
    catch (error) {
        if (error instanceof VadProcessingError)
            throw error;
        throw inferenceFailure("VAD model inference failed", error);
    }
}
function hamming(frameIndex) {
    return (0.54 -
        0.46 * Math.cos((2 * Math.PI * frameIndex) / (VAD_OUTPUT_FRAMES - 1)));
}
function labelAt(logits, frameOffset) {
    let label = 0;
    let maximum = logits[frameOffset];
    for (let index = 1; index < VAD_CLASSES; index += 1) {
        const value = logits[frameOffset + index];
        if (value > maximum) {
            maximum = value;
            label = index;
        }
    }
    return label;
}
class FrameAccumulator {
    speech = new Float64Array(ACCUMULATOR_CAPACITY);
    speakerTurns = new Float64Array(ACCUMULATOR_CAPACITY);
    tags = new Int32Array(ACCUMULATOR_CAPACITY).fill(-1);
    weights = new Float64Array(ACCUMULATOR_CAPACITY);
    nextFrame = 0;
    maxPendingFrames = 0;
    add(frameIndex, speech, speakerTurn, weight) {
        const span = frameIndex - this.nextFrame + 1;
        if (span < 1 || span > ACCUMULATOR_CAPACITY) {
            throw inferenceFailure("VAD aggregation exceeded its bounded frame window");
        }
        const slot = frameIndex % ACCUMULATOR_CAPACITY;
        if (this.tags[slot] !== frameIndex) {
            if (this.tags[slot] !== -1)
                throw inferenceFailure("VAD frame ring collision");
            this.tags[slot] = frameIndex;
            this.speech[slot] = 0;
            this.speakerTurns[slot] = 0;
            this.weights[slot] = 0;
        }
        this.speech[slot] = this.speech[slot] + speech * weight;
        this.speakerTurns[slot] = this.speakerTurns[slot] + speakerTurn * weight;
        this.weights[slot] = this.weights[slot] + weight;
        this.maxPendingFrames = Math.max(this.maxPendingFrames, span);
    }
    drainBefore(endFrame, sink) {
        while (this.nextFrame < endFrame) {
            const slot = this.nextFrame % ACCUMULATOR_CAPACITY;
            const weight = this.tags[slot] === this.nextFrame ? this.weights[slot] : 0;
            sink({
                index: this.nextFrame,
                speech: weight > 0 ? this.speech[slot] / weight : 0,
                speakerTurn: weight > 0 ? this.speakerTurns[slot] / weight : 0,
            });
            this.tags[slot] = -1;
            this.nextFrame += 1;
        }
    }
}
class SpeakerTurnSmoother {
    sink;
    frames = [];
    constructor(sink) {
        this.sink = sink;
    }
    push(frame) {
        this.frames.push(frame);
        if (this.frames.length >= TURN_LOOKAHEAD)
            this.emitFirst();
    }
    finish() {
        while (this.frames.length > 0)
            this.emitFirst();
    }
    emitFirst() {
        const current = this.frames[0];
        const lookahead = Math.min(TURN_LOOKAHEAD, this.frames.length);
        if (current.speakerTurn > 0) {
            let sum = 0;
            for (let index = 0; index < lookahead; index += 1) {
                sum += this.frames[index].speakerTurn;
            }
            if (sum > current.speakerTurn) {
                current.speakerTurn = sum;
                for (let index = 1; index < lookahead; index += 1) {
                    this.frames[index].speakerTurn = 0;
                }
            }
        }
        this.sink(current);
        this.frames.shift();
    }
}
function frameStartMs(frameIndex) {
    return Math.floor((frameIndex * 10_000) / VAD_OUTPUT_FRAMES);
}
function frameEndMs(frameIndex) {
    return Math.ceil((frameIndex * 10_000) / VAD_OUTPUT_FRAMES);
}
class SpeechBlockBuilder {
    frames = [];
    priorTurns = [];
    speaking = false;
    blocks = [];
    push(frame) {
        this.frames.push(frame);
        if (this.frames.length >= 3)
            this.emitFirst();
    }
    finish() {
        while (this.frames.length > 0)
            this.emitFirst();
    }
    nearbySpeakerTurn() {
        return Math.max(0, ...this.priorTurns, ...this.frames.slice(0, 3).map((frame) => frame.speakerTurn));
    }
    startBlock(frame) {
        if (this.blocks.length >= MAX_RAW_BLOCKS) {
            throw new VadProcessingError("RESOURCE_LIMIT", "Too many VAD speech blocks");
        }
        const startMs = frameStartMs(frame.index);
        this.blocks.push({ startMs, endMs: startMs, speakerTurn: this.nearbySpeakerTurn() });
    }
    emitFirst() {
        const current = this.frames[0];
        if (!this.speaking && current.speech > SPEECH_THRESHOLD) {
            this.speaking = true;
            this.startBlock(current);
        }
        else if (this.speaking && current.speakerTurn > SPEAKER_TURN_THRESHOLD) {
            this.speaking = (this.frames[1]?.speech ?? 0) > SPEECH_THRESHOLD;
            if (this.speaking)
                this.startBlock(current);
        }
        else if (this.speaking && current.speech < SPEECH_THRESHOLD) {
            this.speaking = false;
        }
        else if (this.speaking) {
            const last = this.blocks.at(-1);
            this.blocks[this.blocks.length - 1] = { ...last, endMs: frameEndMs(current.index) };
        }
        this.priorTurns.push(current.speakerTurn);
        if (this.priorTurns.length > 3)
            this.priorTurns.shift();
        this.frames.shift();
    }
}
function addWindow(accumulator, logits, batchWindow, globalWindow, totalOutputFrames) {
    let currentSpeaker = 0;
    const startFrame = outputStart(globalWindow);
    for (let frame = 0; frame < VAD_OUTPUT_FRAMES; frame += 1) {
        const offset = (batchWindow * VAD_OUTPUT_FRAMES + frame) * VAD_CLASSES;
        const label = labelAt(logits, offset);
        const speakerTurn = frame > 0 && currentSpeaker !== 0 && label !== currentSpeaker && label > 0 && label < 4
            ? 1
            : 0;
        if (label > 0 && label < 4)
            currentSpeaker = label;
        const outputFrame = startFrame + frame;
        if (outputFrame < totalOutputFrames) {
            accumulator.add(outputFrame, Number(label > 0), speakerTurn, hamming(frame));
        }
    }
}
export async function runBoundedVad(reader, model) {
    const streaming = new StreamingBoundedVad(reader, model);
    await streaming.advance(reader.metadata.frameCount, true);
    const result = streaming.snapshot(reader.metadata.durationMs);
    return {
        ...result,
        metrics: streaming.metrics,
    };
}
//# sourceMappingURL=bounded-vad.js.map