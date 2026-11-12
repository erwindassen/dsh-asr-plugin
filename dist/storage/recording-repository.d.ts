import type { DatabaseSync } from "node:sqlite";
import type { BeginRecordingFinalizationInput, CreateRecordingInput, MeetingRecord, RecordRecordingStartedInput, RecordRecordingRecoveryFailureInput, RecordRecoveredRecordingSourceInput } from "./types.js";
export declare function listRecordingsNeedingRecovery(database: DatabaseSync): readonly MeetingRecord[];
export declare function beginRecordingFinalization(database: DatabaseSync, input: BeginRecordingFinalizationInput): MeetingRecord;
export declare function createRecording(database: DatabaseSync, input: CreateRecordingInput): MeetingRecord;
export declare function recordRecordingStarted(database: DatabaseSync, input: RecordRecordingStartedInput): MeetingRecord;
export declare function recordRecoveredRecordingSource(database: DatabaseSync, input: RecordRecoveredRecordingSourceInput): MeetingRecord;
export declare function recordRecordingRecoveryFailure(database: DatabaseSync, input: RecordRecordingRecoveryFailureInput): MeetingRecord;
