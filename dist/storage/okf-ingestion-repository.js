import { inReadOperation, inWriteTransaction } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";
import { okfIngestionRecordFromRow } from "./row-mappers.js";
import { validateBeginOkfIngestion, validateFinishOkfIngestion, validateOkfIngestionKey, validateOkfIngestionMeeting, } from "./validation.js";
const MAX_LIST_LIMIT = 100;
class SqliteOkfIngestionRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    beginAttempt(input) {
        validateBeginOkfIngestion(input);
        return inWriteTransaction(this.database, () => {
            this.requireMeeting(input.meetingId);
            this.database.prepare(`
        INSERT INTO okf_ingestion (
          meeting_id, transcript_version, directory, state, attempt,
          started_at_ms, finished_at_ms, error_code, error_message
        ) VALUES (?, ?, ?, 'running', 1, ?, NULL, NULL, NULL)
        ON CONFLICT (meeting_id, transcript_version, directory) DO UPDATE SET
          state = 'running',
          attempt = okf_ingestion.attempt + 1,
          started_at_ms = excluded.started_at_ms,
          finished_at_ms = NULL,
          error_code = NULL,
          error_message = NULL
      `).run(input.meetingId, input.transcriptVersion, input.directory, input.startedAtMs);
            return this.requireAttempt(input.meetingId, input.transcriptVersion, input.directory);
        });
    }
    finishAttempt(input) {
        validateFinishOkfIngestion(input);
        return inWriteTransaction(this.database, () => {
            const result = this.database.prepare(`
        UPDATE okf_ingestion SET
          state = ?, finished_at_ms = ?, error_code = ?, error_message = ?
        WHERE meeting_id = ? AND transcript_version = ? AND directory = ?
      `).run(input.state, input.finishedAtMs, input.errorCode ?? null, input.errorMessage ?? null, input.meetingId, input.transcriptVersion, input.directory);
            if (result.changes !== 1) {
                throw new MeetingRepositoryError("RUN_STATE_CONFLICT", "OKF ingestion attempt was not started");
            }
            return this.requireAttempt(input.meetingId, input.transcriptVersion, input.directory);
        });
    }
    findAttempt(meetingId, transcriptVersion, directory) {
        validateOkfIngestionKey(meetingId, transcriptVersion, directory);
        return inReadOperation(() => {
            const row = this.database.prepare(`
        SELECT * FROM okf_ingestion
        WHERE meeting_id = ? AND transcript_version = ? AND directory = ?
      `).get(meetingId, transcriptVersion, directory);
            return row === undefined ? undefined : okfIngestionRecordFromRow(row);
        });
    }
    findLatestForMeeting(meetingId) {
        validateOkfIngestionMeeting(meetingId);
        return inReadOperation(() => {
            const row = this.database.prepare(`
        SELECT * FROM okf_ingestion
        WHERE meeting_id = ?
        ORDER BY started_at_ms DESC, attempt DESC
        LIMIT 1
      `).get(meetingId);
            return row === undefined ? undefined : okfIngestionRecordFromRow(row);
        });
    }
    listForMeeting(meetingId, limit) {
        validateOkfIngestionMeeting(meetingId);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
            throw new MeetingRepositoryError("INVALID_INPUT", "Pagination limit is invalid");
        }
        return inReadOperation(() => this.database.prepare(`
      SELECT * FROM okf_ingestion
      WHERE meeting_id = ?
      ORDER BY started_at_ms DESC, attempt DESC
      LIMIT ?
    `).all(meetingId, limit).map(okfIngestionRecordFromRow));
    }
    listRunning(limit) {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
            throw new MeetingRepositoryError("INVALID_INPUT", "Pagination limit is invalid");
        }
        return inReadOperation(() => this.database.prepare(`
      SELECT * FROM okf_ingestion
      WHERE state = 'running'
      ORDER BY started_at_ms ASC
      LIMIT ?
    `).all(limit).map(okfIngestionRecordFromRow));
    }
    requireMeeting(meetingId) {
        const row = this.database.prepare("SELECT 1 AS found FROM meetings WHERE meeting_id = ?").get(meetingId);
        if (row === undefined) {
            throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
        }
    }
    requireAttempt(meetingId, transcriptVersion, directory) {
        const attempt = this.findAttempt(meetingId, transcriptVersion, directory);
        if (attempt === undefined) {
            throw new MeetingRepositoryError("STORAGE_FAILURE", "OKF ingestion attempt disappeared");
        }
        return attempt;
    }
}
export function createOkfIngestionRepository(database) {
    return new SqliteOkfIngestionRepository(database);
}
//# sourceMappingURL=okf-ingestion-repository.js.map