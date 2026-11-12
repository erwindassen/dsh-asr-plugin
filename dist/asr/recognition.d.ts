import type { AsrEngine, ProcessingMode } from "../assets/processing-identity.js";
import type { FunAsrPunctuator, FunAsrRecognizer } from "./funasr/pipeline.js";
/**
 * Recognizer weights are family-specific; the shared acoustic assets (VAD,
 * speaker embedding) are language agnostic and belong to no engine.
 */
export declare function recognitionAssetIds(engine: AsrEngine): readonly string[];
/**
 * Parakeet is self-punctuating, so it never loads the punctuation pack.
 */
export declare function punctuationAssetIds(mode: ProcessingMode, engine: AsrEngine): readonly string[];
export interface EnginePaths {
    readonly asrCmvnPath: string;
    readonly asrConfigPath: string;
    readonly asrModelPath: string;
    readonly asrTokensPath: string;
    readonly fbankPath: string;
    readonly punctuationConfigPath?: string | undefined;
    readonly punctuationModelPath?: string | undefined;
    readonly punctuationTokensPath?: string | undefined;
    readonly parakeetDecoderPath: string;
    readonly parakeetEncoderPath: string;
    readonly parakeetJoinerPath: string;
    readonly parakeetTokensPath: string;
}
export interface LoadedRecognitionEngine {
    readonly engine: AsrEngine;
    readonly recognizer: FunAsrRecognizer;
    readonly loadPunctuator: (() => Promise<FunAsrPunctuator>) | undefined;
}
/**
 * Loads the recognizer of the selected family once per Worker. The returned
 * punctuator loader is undefined for self-punctuating engines.
 */
export declare function loadRecognitionEngine(engine: AsrEngine, paths: EnginePaths): Promise<LoadedRecognitionEngine>;
export declare function requireEnginePath(paths: Readonly<Record<string, string>>, id: string): string;
