import { encodeProcessingIdentity } from "./processing-identity.js";
import { inReadOperation, inWriteTransaction, openMeetingDatabase, } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";
import { listMeetingReferenceRecords as queryMeetingReferenceRecords } from "./meeting-reference-query.js";
import { getCommittedTranscriptSlice as queryCommittedTranscriptSlice, getCommittedTranscriptSnapshot as queryCommittedTranscriptSnapshot, getMeetingPage as queryMeetingPage, searchMeetings as queryMeetings, } from "./meeting-query.js";
import { parseMeetingRow } from "./row-mappers.js";
import { beginRecordingFinalization as beginRecordingFinalizationState, createRecording as createRecordingState, listRecordingsNeedingRecovery as listRecordingsNeedingRecoveryState, recordRecoveredRecordingSource as recordRecoveredRecordingSourceState, recordRecordingStarted as recordRecordingStartedState, recordRecordingRecoveryFailure as recordRecordingRecoveryFailureState, } from "./recording-repository.js";
import { validateBeginDeletion, validateBeginRetranscription, validateCommitIdentity, validateCompleteDeletion, validateCreateImport, validateFinishRun, validateRecordDeletionFailure, validateRecordManagedSource, validateTranscriptCandidate, } from "./validation.js";
class SqliteMeetingRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    beginDeletion(input) {
        validateBeginDeletion(input);
        return inWriteTransaction(this.database, () => {
            const current = this.getRequiredMeeting(input.meetingId);
            this.assertExpectedVersion(current, input.expectedVersion);
            if (current.status === "deleting") {
                return { outcome: "resumed", meeting: current };
            }
            if (["recording", "processing"].includes(current.status)) {
                throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Active meeting cannot be deleted");
            }
            const update = this.database.prepare(`
        UPDATE meetings SET status = 'deleting', error_code = NULL,
          error_stage = NULL, updated_at_ms = max(updated_at_ms, ?)
        WHERE meeting_id = ? AND transcript_version = ?
          AND status IN ('completed', 'empty', 'partial', 'failed', 'cancelled')
      `).run(input.nowMs, input.meetingId, input.expectedVersion);
            if (update.changes !== 1) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Deletion fence was not established");
            }
            return { outcome: "started", meeting: this.getRequiredMeeting(input.meetingId) };
        });
    }
    beginRecordingFinalization(input) {
        return beginRecordingFinalizationState(this.database, input);
    }
    close() {
        this.database.close();
    }
    completeDeletion(input) {
        validateCompleteDeletion(input);
        inWriteTransaction(this.database, () => {
            const current = this.getRequiredMeeting(input.meetingId);
            this.assertExpectedVersion(current, input.expectedVersion);
            if (current.status !== "deleting") {
                throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Meeting is not being deleted");
            }
            const result = this.database.prepare(`
        DELETE FROM meetings
        WHERE meeting_id = ? AND transcript_version = ? AND status = 'deleting'
      `).run(input.meetingId, input.expectedVersion);
            if (result.changes !== 1) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Deletion fence changed");
            }
        });
    }
    beginRetranscription(input) {
        validateBeginRetranscription(input);
        return inWriteTransaction(this.database, () => {
            const current = this.getRequiredMeeting(input.meetingId);
            if (current.transcriptVersion !== input.expectedVersion) {
                throw new MeetingRepositoryError("TRANSCRIPT_VERSION_CONFLICT", "Transcript version changed");
            }
            const allowed = [
                "completed", "empty", "partial", "failed", "cancelled",
            ];
            if (!allowed.includes(current.status)) {
                throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Meeting cannot be retranscribed");
            }
            if (this.hasActiveRun()) {
                throw new MeetingRepositoryError("ENGINE_BUSY", "Another transcription is active");
            }
            const update = this.database.prepare(`
        UPDATE meetings SET status = 'processing', active_run_id = ?,
          run_kind = 'retranscribe', error_code = NULL, error_stage = NULL,
          updated_at_ms = ?, run_identity = ?
        WHERE meeting_id = ? AND transcript_version = ?
          AND status IN ('completed', 'empty', 'partial', 'failed', 'cancelled')
      `).run(input.runId, input.nowMs, encodeProcessingIdentity(input.processingIdentity), input.meetingId, input.expectedVersion);
            if (update.changes !== 1) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Retranscription did not start");
            }
            return {
                baseVersion: input.expectedVersion,
                targetVersion: input.expectedVersion + 1,
                meeting: this.getRequiredMeeting(input.meetingId),
            };
        });
    }
    createImport(input) {
        validateCreateImport(input);
        inWriteTransaction(this.database, () => {
            if (this.hasActiveRun()) {
                throw new MeetingRepositoryError("ENGINE_BUSY", "Another transcription is active");
            }
            this.database.prepare(`
        INSERT INTO meetings (
          meeting_id, origin, title, source_name, source_format, source_size_bytes,
          status, active_run_id, run_kind, created_at_ms, updated_at_ms, run_identity
        ) VALUES (?, 'import', ?, ?, ?, ?, 'processing', ?, 'import', ?, ?, ?)
      `).run(input.meetingId, input.title, input.sourceName, input.sourceFormat, input.sourceSizeBytes, input.runId, input.nowMs, input.nowMs, encodeProcessingIdentity(input.processingIdentity));
        });
    }
    createRecording(input) {
        return createRecordingState(this.database, input);
    }
    commitTranscript(input) {
        validateCommitIdentity(input);
        return inWriteTransaction(this.database, () => {
            const current = this.getMeeting(input.meetingId);
            if (current === null) {
                throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
            }
            if (current.status !== "processing" || current.activeRunId !== input.runId
                || current.transcriptVersion !== input.baseVersion) {
                return { outcome: "run_not_active", meeting: current };
            }
            if (current.runIdentity !== null && current.runIdentity.engineFingerprint !== input.engineFingerprint) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Transcript processing identity changed");
            }
            validateTranscriptCandidate(input);
            this.assertCommitSource(current, input);
            const newVersion = input.baseVersion + 1;
            this.replaceSegments(input, newVersion);
            this.completeTranscriptCommit(input, newVersion);
            return { outcome: "committed", meeting: this.getRequiredMeeting(input.meetingId) };
        });
    }
    finishRun(input) {
        validateFinishRun(input);
        return inWriteTransaction(this.database, () => {
            const current = this.getRequiredMeeting(input.meetingId);
            this.assertRecordingEnd(current, input);
            const endedAtMs = input.recordingEndedAtMs ?? null;
            const update = this.database.prepare(`
        UPDATE meetings SET
          status = ?, active_run_id = NULL, run_kind = NULL,
          error_code = ?, error_stage = ?,
          updated_at_ms = max(updated_at_ms, ?, COALESCE(?, 0)),
          recording_ended_at_ms = CASE
            WHEN ? IS NULL THEN recording_ended_at_ms
            ELSE COALESCE(recording_ended_at_ms, ?)
          END
        WHERE meeting_id = ? AND status IN ('recording', 'processing')
          AND active_run_id = ? AND transcript_version = ?
      `).run(input.outcome, input.errorCode, input.errorStage, input.nowMs, endedAtMs, endedAtMs, endedAtMs, input.meetingId, input.runId, input.baseVersion);
            const meeting = this.getRequiredMeeting(input.meetingId);
            if (update.changes === 1)
                return { outcome: "updated", meeting };
            if (meeting.transcriptVersion > input.baseVersion
                && meeting.committedStatus !== null) {
                return { outcome: "already_committed", meeting };
            }
            throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Run did not finish its target");
        });
    }
    assertRecordingEnd(current, input) {
        if (input.recordingEndedAtMs === undefined)
            return;
        const isTargetRun = current.activeRunId === input.runId
            && current.transcriptVersion === input.baseVersion
            && ["recording", "processing"].includes(current.status);
        if (!isTargetRun)
            return;
        if (current.runKind !== "recording" || current.recordingStartedAtMs === null
            || input.recordingEndedAtMs < current.recordingStartedAtMs) {
            throw new MeetingRepositoryError("INVALID_INPUT", "Recording end is not trustworthy");
        }
    }
    getMeeting(meetingId) {
        return inReadOperation(() => {
            const row = this.database.prepare(`
        SELECT * FROM meetings WHERE meeting_id = ?
      `).get(meetingId);
            return row === undefined ? null : parseMeetingRow(row);
        });
    }
    hasRecordingHistory() {
        return inReadOperation(() => this.database.prepare(`
      SELECT 1 FROM meetings WHERE origin = 'recording'
        AND recording_started_at_ms IS NOT NULL AND status <> 'deleting' LIMIT 1
    `).get() !== undefined);
    }
    getCommittedTranscriptSlice(input) {
        return queryCommittedTranscriptSlice(this.database, input);
    }
    getCommittedTranscriptSnapshot(meetingId) {
        return queryCommittedTranscriptSnapshot(this.database, meetingId);
    }
    getMeetingPage(input) {
        return queryMeetingPage(this.database, input);
    }
    listMeetingReferenceRecords(input) {
        return queryMeetingReferenceRecords(this.database, input);
    }
    listDeletingMeetings() {
        return inReadOperation(() => this.database.prepare(`
      SELECT * FROM meetings WHERE status = 'deleting'
      ORDER BY created_at_ms, meeting_id
    `).all().map(parseMeetingRow));
    }
    listRecordingsNeedingRecovery() {
        return listRecordingsNeedingRecoveryState(this.database);
    }
    recordDeletionFailure(input) {
        validateRecordDeletionFailure(input);
        return inWriteTransaction(this.database, () => {
            const current = this.getRequiredMeeting(input.meetingId);
            this.assertExpectedVersion(current, input.expectedVersion);
            if (current.status !== "deleting") {
                throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Meeting is not being deleted");
            }
            this.database.prepare(`
        UPDATE meetings SET error_code = 'DELETE_INCOMPLETE',
          error_stage = 'deleting_files', updated_at_ms = max(updated_at_ms, ?)
        WHERE meeting_id = ? AND transcript_version = ? AND status = 'deleting'
      `).run(input.nowMs, input.meetingId, input.expectedVersion);
            return this.getRequiredMeeting(input.meetingId);
        });
    }
    recordManagedSource(input) {
        validateRecordManagedSource(input);
        return inWriteTransaction(this.database, () => {
            const update = this.database.prepare(`
        UPDATE meetings SET source_sha256 = ?, updated_at_ms = ?
        WHERE meeting_id = ? AND status = 'processing'
          AND active_run_id = ? AND source_sha256 IS NULL
      `).run(input.sourceSha256, input.nowMs, input.meetingId, input.runId);
            const meeting = this.getRequiredMeeting(input.meetingId);
            if (update.changes === 1)
                return { outcome: "updated", meeting };
            if (meeting.status === "processing" && meeting.activeRunId === input.runId
                && meeting.sourceSha256 !== null && meeting.sourceSha256 !== input.sourceSha256) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Managed source changed");
            }
            if (meeting.status === "processing" && meeting.activeRunId === input.runId
                && meeting.sourceSha256 === input.sourceSha256) {
                return { outcome: "updated", meeting };
            }
            return { outcome: "run_not_active", meeting };
        });
    }
    recordRecoveredRecordingSource(input) {
        return recordRecoveredRecordingSourceState(this.database, input);
    }
    recordRecordingRecoveryFailure(input) {
        return recordRecordingRecoveryFailureState(this.database, input);
    }
    recordRecordingStarted(input) {
        return recordRecordingStartedState(this.database, input);
    }
    reconcileOrphanedRuns(nowMs) {
        if (!Number.isSafeInteger(nowMs) || nowMs <= 0) {
            throw new MeetingRepositoryError("INVALID_INPUT", "Timestamp is invalid");
        }
        return inWriteTransaction(this.database, () => {
            const result = this.database.prepare(`
        UPDATE meetings SET
          status = 'failed', active_run_id = NULL, run_kind = NULL,
          error_code = 'ORPHANED_BY_RESTART', error_stage = 'startup',
          updated_at_ms = max(updated_at_ms, ?)
        WHERE status IN ('recording', 'processing')
      `).run(nowMs);
            return Number(result.changes);
        });
    }
    searchMeetings(input) {
        return queryMeetings(this.database, input);
    }
    completeTranscriptCommit(input, newVersion) {
        const update = this.database.prepare(`
      UPDATE meetings SET
        status = ?, committed_status = ?, transcript_version = ?, result_reason = ?,
        engine_fingerprint = ?, duration_ms = ?, transcript_identity = run_identity,
        source_size_bytes = COALESCE(source_size_bytes, ?),
        source_sha256 = COALESCE(source_sha256, ?),
        active_run_id = NULL, run_kind = NULL,
        error_code = NULL, error_stage = NULL,
        updated_at_ms = max(updated_at_ms, ?)
      WHERE meeting_id = ? AND status = 'processing'
        AND active_run_id = ? AND transcript_version = ?
    `).run(input.resultStatus, input.resultStatus, newVersion, input.resultReason, input.engineFingerprint, input.durationMs, input.sourceSizeBytes ?? null, input.sourceSha256 ?? null, input.nowMs, input.meetingId, input.runId, input.baseVersion);
        if (update.changes !== 1) {
            throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Transcript commit lost its run");
        }
    }
    getRequiredMeeting(meetingId) {
        const meeting = this.getMeeting(meetingId);
        if (meeting === null) {
            throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
        }
        return meeting;
    }
    assertCommitSource(current, input) {
        const inputSize = input.sourceSizeBytes ?? null;
        const inputHash = input.sourceSha256 ?? null;
        if (current.origin === "recording"
            && ((current.sourceSizeBytes ?? inputSize) === null
                || (current.sourceSha256 ?? inputHash) === null)) {
            throw new MeetingRepositoryError("INVALID_INPUT", "Recording source metadata is required");
        }
        if (inputSize !== null && current.sourceSizeBytes !== null
            && inputSize !== current.sourceSizeBytes) {
            throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Managed source size changed");
        }
        if (inputHash !== null && current.sourceSha256 !== null
            && inputHash !== current.sourceSha256) {
            throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "Managed source fingerprint changed");
        }
    }
    assertExpectedVersion(meeting, expectedVersion) {
        if (meeting.transcriptVersion !== expectedVersion) {
            throw new MeetingRepositoryError("TRANSCRIPT_VERSION_CONFLICT", "Transcript version changed");
        }
    }
    hasActiveRun() {
        return this.database.prepare("SELECT 1 AS found FROM meetings WHERE status IN ('recording', 'processing') LIMIT 1").get() !== undefined;
    }
    replaceSegments(input, newVersion) {
        this.database.prepare("DELETE FROM segments WHERE meeting_id = ?").run(input.meetingId);
        const insert = this.database.prepare(`
      INSERT INTO segments (
        meeting_id, transcript_version, seq, start_ms, end_ms, speaker_label, text
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        for (const segment of input.segments) {
            insert.run(input.meetingId, newVersion, segment.seq, segment.startMs, segment.endMs, segment.speakerLabel, segment.text);
        }
    }
}
export function openMeetingRepository(filename) {
    return new SqliteMeetingRepository(openMeetingDatabase(filename));
}
export { MeetingRepositoryError } from "./errors.js";
//# sourceMappingURL=meeting-repository.js.map