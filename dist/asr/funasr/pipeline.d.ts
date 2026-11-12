import type { Pcm16WavReader } from "../../audio/wav-reader.js";
import type { SpeechRegion } from "../vad-regions.js";
import type { FunAsrTokenUnit } from "./text.js";
export interface FunAsrChunkPunctuation {
    readonly ids: readonly number[];
    readonly list: readonly string[];
}
export interface FunAsrChunkDraft {
    readonly featureFrames: number;
    readonly frontendMs: number;
    readonly inferenceMs: number;
    readonly puncInput: string;
    /**
     * Punctuation decided by the recognizer itself. Self-punctuating engines set
     * this and the pipeline then skips the separate punctuator.
     */
    readonly punctuation?: FunAsrChunkPunctuation | undefined;
    readonly rawText: string;
    readonly timestampsMs: readonly (readonly [number, number])[] | null;
    readonly tokenCount: number;
    readonly tokens: readonly string[];
}
export interface FunAsrRecognizer {
    close(): Promise<void>;
    recognize(samples: Float32Array): Promise<FunAsrChunkDraft>;
}
export interface FunAsrPunctuationResult {
    readonly inferenceMs: number;
    readonly punctuationIds: readonly number[];
    readonly text: string;
}
export interface FunAsrPunctuator {
    readonly punctuationList: readonly string[];
    close(): Promise<void>;
    punctuate(text: string): Promise<FunAsrPunctuationResult>;
}
export interface FunAsrRuntimeFactory {
    /** Absent for recognizers that decide punctuation themselves. */
    loadPunctuator?: (() => Promise<FunAsrPunctuator>) | undefined;
    loadRecognizer(): Promise<FunAsrRecognizer>;
}
export interface LoadedFunAsrRuntime {
    readonly recognizer: FunAsrRecognizer;
    readonly mode?: "base" | "enhanced";
    readonly punctuator?: FunAsrPunctuator;
}
export interface FunAsrBlock {
    readonly endMs: number;
    readonly seq: number;
    readonly startMs: number;
    readonly text: string;
}
export interface FunAsrMetrics {
    readonly asrInferenceMs: number;
    readonly chunkCount: number;
    readonly featureFrames: number;
    readonly frontendMs: number;
    readonly punctuationInferenceMs: number;
    readonly tokenCount: number;
}
export interface FunAsrResult {
    readonly blocks: readonly FunAsrBlock[];
    readonly emptyReason: "silent" | "too_short" | null;
    readonly metrics: FunAsrMetrics;
}
export interface FunAsrDraftResult {
    readonly emptyReason: "silent" | "too_short" | null;
    readonly metrics: FunAsrMetrics;
    readonly units: readonly FunAsrTokenUnit[];
}
export declare function runFunAsr(reader: Pcm16WavReader, chunks: readonly SpeechRegion[], factory: FunAsrRuntimeFactory, mode?: "base" | "enhanced"): Promise<FunAsrResult>;
export declare function runFunAsrWithLoadedRuntime(reader: Pcm16WavReader, chunks: readonly SpeechRegion[], runtime: LoadedFunAsrRuntime): Promise<FunAsrResult>;
export declare function runFunAsrDraftWithLoadedRuntime(reader: Pcm16WavReader, chunks: readonly SpeechRegion[], runtime: LoadedFunAsrRuntime): Promise<FunAsrDraftResult>;
