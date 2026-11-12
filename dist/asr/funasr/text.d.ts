export interface FunAsrPostprocessedText {
    readonly sentence: string;
    readonly tokens: string[];
}
export interface FunAsrPostprocessedWithTimestamps extends FunAsrPostprocessedText {
    readonly timestamps: Array<[number, number]>;
}
export interface FunAsrSentenceBlock {
    readonly endMs: number;
    readonly startMs: number;
    readonly text: string;
}
export interface FunAsrTokenUnit {
    readonly breakAfter: boolean;
    readonly endMs: number;
    readonly startMs: number;
    readonly text: string;
}
export declare function sentencePostprocess(words: readonly string[]): FunAsrPostprocessedText;
export declare function sentencePostprocessWithTimestamps(words: readonly string[], timestamps: readonly (readonly [number, number])[]): FunAsrPostprocessedWithTimestamps;
export declare function splitToMiniSentences<T>(words: readonly T[], wordLimit?: number): T[][];
export declare function codeMixSplitWords(text: string): string[];
export declare function appendToken(current: string, token: string): string;
export declare function buildTokenUnits(tokens: readonly string[], timestamps: readonly (readonly [number, number])[], punctuationIds: readonly number[], punctuationList: readonly string[], chunkStartMs: number, chunkEndMs: number): FunAsrTokenUnit[];
export declare function buildSentenceBlocks(tokens: readonly string[], timestamps: readonly (readonly [number, number])[], punctuationIds: readonly number[], punctuationList: readonly string[], chunkStartMs: number, chunkEndMs: number): FunAsrSentenceBlock[];
export declare class TokenIdConverter {
    #private;
    constructor(tokenList: readonly string[]);
    idsToTokens(ids: Iterable<number>): string[];
    tokensToIds(tokens: Iterable<string>): number[];
}
