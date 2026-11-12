import type { SpeechRegion } from "../asr/vad-regions.js";
export declare function stableVadPrefix(chunks: readonly SpeechRegion[], availableMs: number): readonly SpeechRegion[];
