import { OkfError } from "./contracts.js";
import { writeOkfPage } from "./page-writer.js";
function unknownSession() {
    return new OkfError("OKF_PAGE_INVALID", "okf_write_page only writes pages while a meeting is being summarised");
}
export function createPageWriteRegistry() {
    const sessions = new Map();
    const registry = {
        open(sessionId, seed) {
            sessions.set(sessionId, { root: seed.root, meetingId: seed.meetingId, pages: new Set() });
        },
        close(sessionId) {
            sessions.delete(sessionId);
        },
        get(sessionId) {
            const active = sessions.get(sessionId);
            if (active === undefined)
                return undefined;
            return {
                sessionId,
                root: active.root,
                meetingId: active.meetingId,
                pages: [...active.pages].sort(),
            };
        },
        async write(sessionId, relativePath, content) {
            const active = sessions.get(sessionId);
            if (active === undefined)
                throw unknownSession();
            const written = await writeOkfPage(active.root, relativePath, content);
            active.pages.add(written.relativePath);
            return written;
        },
    };
    return registry;
}
//# sourceMappingURL=write-session.js.map