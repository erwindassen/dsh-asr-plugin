import type { ClosedRecordingChunks } from "./closed-recording-chunks.js";
import { type RecordingTrack } from "./recording-timeline.js";
declare const CANDIDATE_FILES: readonly ["audio.tmp.wav", "mic.tmp.wav", "system.tmp.wav"];
export type RecordingAudioCandidateFile = (typeof CANDIDATE_FILES)[number];
export interface RecordingAudioPaths {
    readonly meetingDirectory: string;
    readonly recordingDirectory: string;
    readonly workRecordingDirectory: string;
}
export interface RecordingAudioCandidateClaim {
    readonly audioFiles: readonly RecordingAudioCandidateFile[];
    readonly durationMs: number;
    readonly sourceSha256: string;
    readonly sourceSizeBytes: number;
}
export interface RecordingAudioCandidate extends RecordingAudioCandidateClaim {
    readonly captureEndUs: number;
    readonly frameCount: number;
    readonly tracks: readonly RecordingTrack[];
}
export interface PromotedRecordingAudio {
    readonly durationMs: number;
    readonly frameCount: number;
    readonly sourceFormat: "wav";
    readonly sourcePath: string;
    readonly sourceSha256: string;
    readonly sourceSizeBytes: number;
    readonly tracks: readonly RecordingTrack[];
}
export declare class RecordingAudioCandidateError extends Error {
    readonly code: "AUDIO_READ_FAILED";
    constructor(message: string, options?: ErrorOptions);
}
export declare function buildRecordingAudioCandidate(paths: RecordingAudioPaths, chunks: ClosedRecordingChunks): Promise<RecordingAudioCandidate>;
export declare function recoverPromotedRecordingAudio(paths: RecordingAudioPaths, maximumDurationMs?: number): Promise<PromotedRecordingAudio | null>;
export declare function verifyAndPromoteRecordingAudio(paths: RecordingAudioPaths, claim: RecordingAudioCandidateClaim, signal?: AbortSignal): Promise<PromotedRecordingAudio>;
export {};
