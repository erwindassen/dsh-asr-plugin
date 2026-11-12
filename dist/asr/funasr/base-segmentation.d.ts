import type { FunAsrSentenceBlock, FunAsrTokenUnit } from "./text.js";
import type { FunAsrChunkDraft } from "./pipeline.js";
import type { SpeechRegion } from "../vad-regions.js";
interface RecognizedChunk {
    readonly draft: FunAsrChunkDraft;
    readonly region: SpeechRegion;
}
export declare function baseTokenUnits(chunks: readonly RecognizedChunk[]): FunAsrTokenUnit[];
export declare function baseBlocks(chunks: readonly RecognizedChunk[]): Array<FunAsrSentenceBlock & {
    seq: number;
}>;
export {};
