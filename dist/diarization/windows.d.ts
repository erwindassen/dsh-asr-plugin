import type { SpeechRegion } from "../asr/vad-regions.js";
export interface EmbeddingBlockTime {
    readonly endMs: number;
    readonly seq: number;
    readonly startMs: number;
    readonly text: string;
}
export interface EmbeddingWindow {
    readonly endMs: number;
    readonly startMs: number;
}
export declare function planEmbeddingWindows(block: EmbeddingBlockTime, speechRegions: readonly SpeechRegion[]): EmbeddingWindow[];
