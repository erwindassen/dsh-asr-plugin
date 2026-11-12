import { createHash, timingSafeEqual } from "node:crypto";
import { MeetingRepositoryError } from "./errors.js";
const CURSOR_DOMAIN = "dsh-asr-plugin.cursor.v1\0";
const MAX_CURSOR_LENGTH = 1_024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function invalidCursor() {
    throw new MeetingRepositoryError("INVALID_INPUT", "Pagination cursor is invalid");
}
function digest(body) {
    return createHash("sha256").update(CURSOR_DOMAIN).update(body).digest("hex");
}
function encodeCursor(payload) {
    const body = JSON.stringify(payload);
    return Buffer.from(`${body}.${digest(body)}`).toString("base64url");
}
function decodeEnvelope(cursor) {
    if (cursor.length < 1 || cursor.length > MAX_CURSOR_LENGTH
        || !/^[A-Za-z0-9_-]+$/.test(cursor))
        invalidCursor();
    try {
        const bytes = Buffer.from(cursor, "base64url");
        if (bytes.toString("base64url") !== cursor)
            invalidCursor();
        const envelope = bytes.toString("utf8");
        const separator = envelope.lastIndexOf(".");
        if (separator < 1)
            invalidCursor();
        const body = envelope.slice(0, separator);
        const actual = envelope.slice(separator + 1);
        const expected = digest(body);
        if (!/^[0-9a-f]{64}$/.test(actual)
            || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
            invalidCursor();
        const payload = JSON.parse(body);
        if (typeof payload !== "object" || payload === null || Array.isArray(payload))
            invalidCursor();
        return payload;
    }
    catch (error) {
        if (error instanceof MeetingRepositoryError)
            throw error;
        return invalidCursor();
    }
}
export function encodeTranscriptCursor(payload) {
    return encodeCursor({ kind: "transcript", ...payload });
}
export function decodeTranscriptCursor(cursor) {
    const payload = decodeEnvelope(cursor);
    if (payload.kind !== "transcript" || !UUID_PATTERN.test(String(payload.meetingId))
        || !Number.isSafeInteger(payload.version) || payload.version < 1
        || !Number.isSafeInteger(payload.lastSeq) || payload.lastSeq < 0
        || (payload.projection !== undefined
            && payload.projection !== "page" && payload.projection !== "agent")
        || (payload.nextSegmentDigest !== undefined
            && (payload.projection !== "agent"
                || !/^[0-9a-f]{64}$/.test(String(payload.nextSegmentDigest)))))
        invalidCursor();
    return payload;
}
export function encodeSearchCursor(payload) {
    return encodeCursor({ kind: "search", ...payload });
}
export function decodeSearchCursor(cursor) {
    const payload = decodeEnvelope(cursor);
    if (payload.kind !== "search" || !/^[0-9a-f]{64}$/.test(String(payload.queryHash))
        || !Number.isSafeInteger(payload.createdAtMs) || payload.createdAtMs <= 0
        || !UUID_PATTERN.test(String(payload.meetingId)))
        invalidCursor();
    return payload;
}
//# sourceMappingURL=query-cursor.js.map