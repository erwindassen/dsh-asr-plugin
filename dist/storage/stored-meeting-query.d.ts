import type { DatabaseSync } from "node:sqlite";
import type { MeetingRecord } from "./types.js";
/**
 * Largest page the panel may ask for. Exported so a reconciliation asks the
 * repository for a page it actually accepts instead of discovering the bound
 * as an INVALID_INPUT error.
 */
export declare const MAX_STORED_MEETINGS = 50;
/**
 * Committed meetings the panel can reopen, newest first.
 *
 * A meeting qualifies only once its transcript version was committed as
 * `completed` or `partial`; a later retranscription keeps the old committed
 * snapshot visible, while a meeting being deleted is already gone.
 */
export declare function listStoredMeetings(database: DatabaseSync, limit: number): readonly MeetingRecord[];
