import { type PromotedRecordingAudio, type RecordingAudioPaths } from "./recording-audio-candidate.js";
export type RecordingRecoveryPaths = RecordingAudioPaths;
export type RecoveredRecordingAudio = PromotedRecordingAudio;
export declare function recoverRecordingAudio(paths: RecordingRecoveryPaths, maximumDurationMs?: number): Promise<RecoveredRecordingAudio>;
