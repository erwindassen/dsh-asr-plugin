import { inReadOperation } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";
import { parseMeetingRow } from "./row-mappers.js";
/**
 * Largest page the panel may ask for. Exported so a reconciliation asks the
 * repository for a page it actually accepts instead of discovering the bound
 * as an INVALID_INPUT error.
 */
export const MAX_STORED_MEETINGS = 50;
/**
 * Committed meetings the panel can reopen, newest first.
 *
 * A meeting qualifies only once its transcript version was committed as
 * `completed` or `partial`; a later retranscription keeps the old committed
 * snapshot visible, while a meeting being deleted is already gone.
 */
export function listStoredMeetings(database, limit) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_STORED_MEETINGS) {
        throw new MeetingRepositoryError("INVALID_INPUT", "Stored meeting limit is invalid");
    }
    return inReadOperation(() => database.prepare(`
    SELECT * FROM meetings
    WHERE status <> 'deleting'
      AND transcript_version >= 1
      AND committed_status IN ('completed', 'partial')
    ORDER BY created_at_ms DESC, meeting_id DESC
    LIMIT ?
  `).all(limit).map(parseMeetingRow));
}
//# sourceMappingURL=stored-meeting-query.js.map