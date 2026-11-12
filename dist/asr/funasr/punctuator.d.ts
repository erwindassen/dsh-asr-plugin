import type { FunAsrPunctuator } from "./pipeline.js";
export interface FunAsrPunctuatorPaths {
    readonly configPath: string;
    readonly modelPath: string;
    readonly tokensPath: string;
}
export declare function loadFunAsrPunctuator(paths: FunAsrPunctuatorPaths): Promise<FunAsrPunctuator>;
