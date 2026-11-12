import type { FunAsrRecognizer } from "./pipeline.js";
export interface FunAsrRecognizerPaths {
    readonly cmvnPath: string;
    readonly configPath: string;
    readonly fbankPath: string;
    readonly modelPath: string;
    readonly tokensPath: string;
}
export declare function loadFunAsrRecognizer(paths: FunAsrRecognizerPaths): Promise<FunAsrRecognizer>;
