import type { FunAsrBlock, FunAsrResult } from "../asr/funasr/pipeline.js";
import type { SpeechRegion } from "../asr/vad-regions.js";
import type { ClosedRecordingChunks } from "../audio/closed-recording-chunks.js";
import { type Pcm16WavReader } from "../audio/wav-reader.js";
import { type MeetingDiarizationResult, type SpeakerEmbeddingModel } from "../diarization/meeting-diarizer.js";
import type { RecordingFinalCache } from "./final-cache.js";
export interface RecordingIncrementalVad {
    advance(frameCount: number, final?: boolean): Promise<void>;
    snapshot(durationMs: number): {
        readonly asrChunks: readonly SpeechRegion[];
        readonly speechRegions: readonly SpeechRegion[];
    };
}
export interface RecordingAuthoritativeKernels {
    readonly embeddingModel: SpeakerEmbeddingModel;
    createVad(reader: Pcm16WavReader): RecordingIncrementalVad;
    transcribe(reader: Pcm16WavReader, chunks: readonly SpeechRegion[]): Promise<FunAsrResult>;
    diarize(reader: Pcm16WavReader, blocks: readonly FunAsrBlock[], speechRegions: readonly SpeechRegion[], cachedEmbeddingModel: SpeakerEmbeddingModel): Promise<MeetingDiarizationResult>;
}
export interface RecordingAuthoritativeEngineOptions {
    readonly cache: RecordingFinalCache;
    readonly chunks: ClosedRecordingChunks;
    readonly engineFingerprint: string;
    readonly kernels: RecordingAuthoritativeKernels;
}
export interface RecordingAuthoritativeResult {
    readonly cacheHits: number;
    readonly cacheMisses: number;
    readonly durationMs: number;
    readonly resultReason: "silent" | "too_short" | "unknown_speaker_segments" | null;
    readonly resultStatus: "completed" | "empty" | "partial";
    readonly segments: readonly {
        readonly seq: number;
        readonly startMs: number;
        readonly endMs: number;
        readonly speakerLabel: string;
        readonly text: string;
    }[];
}
export declare class RecordingAuthoritativeError extends Error {
    readonly code: "INTERNAL_ERROR";
    constructor(message: string, options?: ErrorOptions);
}
export declare class RecordingAuthoritativeEngine {
    private readonly options;
    private readonly asr;
    private readonly embeddings;
    private readonly embeddingKeys;
    private finalized;
    private reader;
    private vad;
    private vadThroughFrames;
    constructor(options: RecordingAuthoritativeEngineOptions);
    advance(): Promise<void>;
    finalize(): Promise<RecordingAuthoritativeResult>;
    private assertActive;
    private synchronize;
    private reset;
    private ensureAsr;
    private ensureWindows;
    private ensureEmbedding;
    private discardObsoleteAsr;
    private cachedEmbeddingQueue;
}
