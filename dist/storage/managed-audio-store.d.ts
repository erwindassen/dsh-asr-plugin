import { type AudioConversionSubprocess, type NormalizedAudio } from "../audio/managed-audio-normalizer.js";
import { type AudioSourceFormat } from "../audio/source-format.js";
import { type RecoveredRecordingAudio } from "../audio/recording-audio-recovery.js";
import { type RecordingAudioCandidateClaim, type PromotedRecordingAudio } from "../audio/recording-audio-candidate.js";
import { type RecordingAudioLayout } from "./managed-audio-paths.js";
import type { MeetingOrigin } from "./types.js";
export type ManagedAudioSubprocess = AudioConversionSubprocess;
export interface ManagedSource {
    readonly sourceFormat: AudioSourceFormat;
    readonly sourcePath: string;
    readonly sourceSha256: string;
    readonly sourceSizeBytes: number;
}
export interface VerifiedAudioInput {
    readonly sourceFormat: AudioSourceFormat;
    readonly sourceName: string;
    readonly sourceSizeBytes: number;
    close(): Promise<void>;
    persist(meetingId: string): Promise<ManagedSource>;
}
export interface ManagedAudioStore {
    assertManagedSource(meetingId: string, sourceFormat: AudioSourceFormat, origin: MeetingOrigin): Promise<void>;
    cleanupAllWork(): Promise<void>;
    cleanupWork(meetingId: string): Promise<void>;
    deleteMeeting(meetingId: string): Promise<{
        readonly freedBytes: number;
    }>;
    normalize(meetingId: string, sourceFormat: AudioSourceFormat, signal?: AbortSignal): Promise<NormalizedAudio>;
    openInput(inputPath: string): Promise<VerifiedAudioInput>;
    prepareRecording(meetingId: string): Promise<RecordingAudioLayout>;
    promoteRecordingCandidate(meetingId: string, candidate: RecordingAudioCandidateClaim, signal?: AbortSignal): Promise<PromotedRecordingAudio>;
    recoverRecording(meetingId: string, maximumDurationMs?: number): Promise<RecoveredRecordingAudio>;
    prepareRetranscription(meetingId: string, sourceFormat: AudioSourceFormat, origin: MeetingOrigin, signal?: AbortSignal): Promise<NormalizedAudio>;
}
export interface ManagedAudioStoreOptions {
    readonly capacityBytes?: (dataRoot: string) => Promise<bigint>;
    readonly conversionDeadline?: () => AbortSignal;
    readonly dataRoot: string;
    readonly subprocess: ManagedAudioSubprocess;
}
export declare function openManagedAudioStore(options: ManagedAudioStoreOptions): Promise<ManagedAudioStore>;
export { ManagedAudioError } from "../audio/managed-audio-error.js";
export type { ManagedAudioErrorCode } from "../audio/managed-audio-error.js";
export type { RecoveredRecordingAudio } from "../audio/recording-audio-recovery.js";
export type { RecordingAudioLayout } from "./managed-audio-paths.js";
