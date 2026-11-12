import type { FunAsrRuntimeFactory } from "./pipeline.js";
export interface FunAsrAssetPaths {
    readonly asrCmvnPath: string;
    readonly asrConfigPath: string;
    readonly asrModelPath: string;
    readonly asrTokensPath: string;
    readonly fbankPath: string;
    readonly punctuationConfigPath?: string | undefined;
    readonly punctuationModelPath?: string | undefined;
    readonly punctuationTokensPath?: string | undefined;
}
export declare function createFunAsrRuntimeFactory(paths: FunAsrAssetPaths): FunAsrRuntimeFactory;
