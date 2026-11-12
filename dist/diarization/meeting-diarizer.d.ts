import type { Pcm16WavReader } from "../audio/wav-reader.js";
import type { SpeechRegion } from "../asr/vad-regions.js";
export declare const MIN_EMBEDDING_MS = 100;
export interface DiarizationBlock {
    readonly endMs: number;
    readonly seq: number;
    readonly startMs: number;
    readonly text: string;
}
export interface DiarizedBlock extends DiarizationBlock {
    readonly speakerLabel: string;
}
export interface SpeakerEmbeddingOutput {
    readonly embedding: Float32Array;
    readonly fbankMs: number;
    readonly inferenceMs: number;
}
export interface SpeakerEmbeddingModel {
    close(): Promise<void>;
    embed(samples: Float32Array): Promise<SpeakerEmbeddingOutput>;
}
export interface SpeakerClusterer {
    cluster(embeddings: readonly Float32Array[], options: {
        readonly height: number;
    }): readonly (readonly number[])[];
}
export type DiarizationWarningCode = "BLOCK_TOO_SHORT" | "EMBEDDING_FAILED" | "LOW_CONFIDENCE" | "NO_CLUSTER_REFERENCE";
export interface DiarizationWarning {
    readonly code: DiarizationWarningCode;
    readonly seq: number;
}
export interface MeetingDiarizationMetrics {
    readonly assignMs: number;
    readonly clusterMs: number;
    readonly embeddedBlockCount: number;
    readonly embeddingWindowCount: number;
    readonly embedMs: number;
    readonly fbankMs: number;
    readonly unknownBlockCount: number;
}
export interface MeetingDiarizationResult {
    readonly metrics: MeetingDiarizationMetrics;
    readonly resultReason: "unknown_speaker_segments" | null;
    readonly resultStatus: "completed" | "partial";
    readonly segments: readonly DiarizedBlock[];
    readonly speakerCount: number;
    readonly warnings: readonly DiarizationWarning[];
}
export interface MeetingDiarizer {
    close(): Promise<void>;
    diarize(reader: Pcm16WavReader, blocks: readonly DiarizationBlock[], speechRegions: readonly SpeechRegion[]): Promise<MeetingDiarizationResult>;
}
export interface MeetingDiarizerDependencies {
    readonly clusterer: SpeakerClusterer;
    readonly embeddingModel: SpeakerEmbeddingModel;
}
export declare function createMeetingDiarizer(dependencies: MeetingDiarizerDependencies): MeetingDiarizer;
