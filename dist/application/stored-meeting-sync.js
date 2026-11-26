/**
 * Reconciles the stored meetings against the Open knowledge base folder.
 *
 * The panel lists meetings from SQLite, but the folder is what the user can see
 * and delete. Syncing therefore treats the folder's transcript copies as the
 * source of truth and removes the stored meetings that are not in it, while
 * never touching a meeting that is still recording (the stored-meeting query
 * only returns committed transcripts, so drafts are out of scope by design).
 */
import { stat } from "node:fs/promises";
import { listBundleMeetingIds } from "../okf/bundle-meetings.js";
import { OkfError } from "../okf/contracts.js";
/** Upper bound for one reconciliation; far above any realistic library. */
export const MAX_SYNC_MEETINGS = 500;
async function scan(deps) {
    const root = deps.directory().trim();
    if (root === "") {
        throw new OkfError("OKF_NOT_CONFIGURED", "Choose an Open knowledge base folder first");
    }
    const stats = await stat(root).catch(() => null);
    if (stats === null || !stats.isDirectory()) {
        throw new OkfError("OKF_INVALID_DIRECTORY", "The Open knowledge base folder does not exist");
    }
    const present = new Set(await listBundleMeetingIds(root));
    const meetings = deps.repository.listStoredMeetings(MAX_SYNC_MEETINGS);
    const missing = meetings
        .filter((meeting) => !present.has(meeting.meetingId.toLowerCase()))
        .map((meeting) => ({ meetingId: meeting.meetingId, version: meeting.transcriptVersion }));
    return { missing, kept: meetings.length - missing.length };
}
/** Builds the reconciler the recording panel's Sync button drives. */
export function createStoredMeetingSync(deps) {
    return {
        async preview() {
            const { missing, kept } = await scan(deps);
            return { removed: missing.length, kept };
        },
        async run() {
            const { missing, kept } = await scan(deps);
            let removed = 0;
            for (const meeting of missing) {
                await deps.remove(meeting.meetingId, meeting.version);
                removed += 1;
            }
            return { removed, kept };
        },
    };
}
//# sourceMappingURL=stored-meeting-sync.js.map