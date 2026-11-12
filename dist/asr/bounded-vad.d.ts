import type { Pcm16WavReader } from "../audio/wav-reader.js";
import type { SpeechRegion } from "./vad-regions.js";
export declare const VAD_WINDOW_SAMPLES = 160000;
export declare const VAD_STEP_SAMPLES = 32000;
export declare const VAD_BATCH_WINDOWS = 6;
export declare const VAD_OUTPUT_FRAMES = 589;
export declare const VAD_CLASSES = 7;
export interface VadInferenceModel {
    infer(input: Float32Array, batchWindows: number): Promise<Float32Array>;
}
export interface BoundedVadMetrics {
    readonly batchCount: number;
    readonly inferenceMs: number;
    readonly maxBatchInputSamples: number;
    readonly maxBatchWindows: number;
    readonly maxPendingFrames: number;
    readonly vadMs: number;
    readonly windowCount: number;
}
export interface BoundedVadResult {
    readonly asrChunks: readonly SpeechRegion[];
    readonly metrics: BoundedVadMetrics;
    readonly speechRegions: readonly SpeechRegion[];
}
export declare class StreamingBoundedVad {
    private readonly reader;
    private readonly model;
    private readonly accumulator;
    private readonly builder;
    private readonly inputBuffer;
    private readonly smoother;
    private readonly started;
    private batchCount;
    private finished;
    private inferenceMs;
    private maxBatchWindows;
    private nextWindow;
    private priorFrameCount;
    constructor(reader: Pcm16WavReader, model: VadInferenceModel);
    get metrics(): BoundedVadMetrics;
    advance(frameCount: number, final?: boolean): Promise<void>;
    snapshot(durationMs: number): Pick<BoundedVadResult, "asrChunks" | "speechRegions">;
    private assertAdvance;
    private processBatch;
    private finish;
}
export declare function runBoundedVad(reader: Pcm16WavReader, model: VadInferenceModel): Promise<BoundedVadResult>;
