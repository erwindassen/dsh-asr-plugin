import type { FunAsrChunkDraft } from "../funasr/pipeline.js";
export interface ParakeetAssetPaths {
    readonly decoderPath: string;
    readonly encoderPath: string;
    readonly joinerPath: string;
    readonly tokensPath: string;
}
export interface ParakeetRecognizerConfig {
    readonly numThreads?: number;
    readonly paths: ParakeetAssetPaths;
}
export interface ParakeetRecognizer {
    close(): Promise<void>;
    recognize(samples: Float32Array): Promise<FunAsrChunkDraft>;
}
/**
 * Loads the transducer recognizer once per Worker and reuses it for every
 * chunk. NeMo v3 checkpoints emit casing and punctuation, so no separate
 * punctuator is loaded for this engine.
 */
export declare function loadParakeetRecognizer(config: ParakeetRecognizerConfig): Promise<ParakeetRecognizer>;
