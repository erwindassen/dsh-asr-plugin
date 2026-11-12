import type { FunAsrCmvn } from "./frontend.js";
export interface FunAsrFrontendConfig {
    readonly frameLengthMs: 25;
    readonly frameShiftMs: 10;
    readonly inputSize: 560;
    readonly lfrM: 7;
    readonly lfrN: 6;
    readonly numMels: 80;
    readonly predictorBias: 1;
    readonly sampleRate: 16_000;
    readonly window: "hamming";
}
export interface FunAsrPunctuationConfig {
    readonly punctuationList: readonly ["<unk>", "_", "，", "。", "？", "、"];
    readonly sentenceEndId: 3;
}
export declare function parseFunAsrFrontendConfig(content: string): FunAsrFrontendConfig;
export declare function parseFunAsrPunctuationConfig(content: string): FunAsrPunctuationConfig;
export declare function parseFunAsrCmvn(content: string): FunAsrCmvn;
export declare function parseTokenList(content: string): readonly string[];
