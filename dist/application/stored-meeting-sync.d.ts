/**
 * Reconciles the stored meetings against the Open knowledge base folder.
 *
 * The panel lists meetings from SQLite, but the folder is what the user can see
 * and delete. Syncing therefore treats the folder's transcript copies as the
 * source of truth and removes the stored meetings that are not in it, while
 * never touching a meeting that is still recording (the stored-meeting query
 * only returns committed transcripts, so drafts are out of scope by design).
 */
import type { MeetingRepository } from "../storage/meeting-repository.js";
/** Upper bound for one reconciliation; far above any realistic library. */
export declare const MAX_SYNC_MEETINGS = 500;
export interface StoredMeetingSyncResult {
    /** Stored meetings the folder does not hold. */
    readonly removed: number;
    /** Stored meetings the folder does hold. */
    readonly kept: number;
}
export interface StoredMeetingSyncDeps {
    readonly repository: Pick<MeetingRepository, "listStoredMeetings">;
    /** Deletes one meeting outright, exactly like the delete tool does. */
    readonly remove: (meetingId: string, expectedVersion: number) => Promise<void>;
    readonly directory: () => string;
}
export interface StoredMeetingSync {
    /** Counts what a sync would remove without removing anything. */
    preview(): Promise<StoredMeetingSyncResult>;
    /** Removes every stored meeting the folder does not hold. */
    run(): Promise<StoredMeetingSyncResult>;
}
/** Builds the reconciler the recording panel's Sync button drives. */
export declare function createStoredMeetingSync(deps: StoredMeetingSyncDeps): StoredMeetingSync;
