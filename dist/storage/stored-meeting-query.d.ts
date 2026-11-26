import type { DatabaseSync } from "node:sqlite";
import type { MeetingRecord } from "./types.js";
/**
 * Committed meetings the panel can reopen, newest first.
 *
 * A meeting qualifies only once its transcript version was committed as
 * `completed` or `partial`; a later retranscription keeps the old committed
 * snapshot visible, while a meeting being deleted is already gone.
 */
export declare function listStoredMeetings(database: DatabaseSync, limit: number): readonly MeetingRecord[];
