import type { FunAsrBlock } from "../asr/funasr/pipeline.js";
export type RecordingCacheKind = "asr" | "embedding";
export interface RecordingFinalCache {
    getAsr(key: string): Promise<readonly FunAsrBlock[] | null>;
    getEmbedding(key: string): Promise<Float32Array | null>;
    putAsr(key: string, blocks: readonly FunAsrBlock[]): Promise<void>;
    putEmbedding(key: string, embedding: Float32Array): Promise<void>;
}
export declare function recordingCacheKey(kind: RecordingCacheKind, engineFingerprint: string, startMs: number, endMs: number, samples: Float32Array): string;
export declare function openRecordingFinalCache(root: string, engineFingerprint: string): Promise<RecordingFinalCache>;
