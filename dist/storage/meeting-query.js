import { createHash } from "node:crypto";
import { inReadTransaction } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";
import { decodeSearchCursor, decodeTranscriptCursor, encodeSearchCursor, encodeTranscriptCursor, } from "./query-cursor.js";
import { parseMeetingRow, parseSegmentRow } from "./row-mappers.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEFAULT_TRANSCRIPT_LIMIT = 100;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SNIPPET_CHARACTERS = 240;
const MAX_TRANSCRIPT_SNAPSHOT_BYTES = 32 * 1024 * 1024;
function invalidInput(message) {
    throw new MeetingRepositoryError("INVALID_INPUT", message);
}
function requireMeetingId(meetingId) {
    if (typeof meetingId !== "string" || !UUID_PATTERN.test(meetingId)) {
        invalidInput("Meeting id is invalid");
    }
}
function pageLimit(value, fallback, maximum) {
    const limit = value ?? fallback;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
        invalidInput("Pagination limit is invalid");
    }
    return limit;
}
function normalizedQuery(value) {
    if (value === undefined)
        return null;
    if (typeof value !== "string")
        invalidInput("Search query is invalid");
    const query = value.trim();
    if (Array.from(query).length > 500)
        invalidInput("Search query is too long");
    return query.length === 0 ? null : query;
}
function fingerprintQuery(query) {
    const value = query === null ? "recent" : `query\0${query}`;
    return createHash("sha256").update(value).digest("hex");
}
function escapeLike(query) {
    return `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}
function ftsPhrase(query) {
    return `"${query.replaceAll('"', '""')}"`;
}
function searchParameters(input) {
    const query = normalizedQuery(input.query);
    const queryHash = fingerprintQuery(query);
    const characterCount = query === null ? 0 : Array.from(query).length;
    const mode = query === null ? "recent" : characterCount < 3 ? "like" : "fts";
    const matchValue = query === null ? null : mode === "like" ? escapeLike(query) : ftsPhrase(query);
    const boundary = input.cursor === undefined ? null : decodeSearchCursor(input.cursor);
    if (boundary !== null && boundary.queryHash !== queryHash)
        invalidInput("Search cursor does not match query");
    return {
        query,
        queryHash,
        mode,
        matchValue,
        boundary,
        limit: pageLimit(input.limit, DEFAULT_SEARCH_LIMIT, 50),
    };
}
function requiredMeeting(database, meetingId) {
    const row = database.prepare("SELECT * FROM meetings WHERE meeting_id = ?").get(meetingId);
    if (row === undefined) {
        throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
    }
    return parseMeetingRow(row);
}
function transcriptBoundary(input, meeting) {
    if (input.cursor === undefined)
        return -1;
    const cursor = decodeTranscriptCursor(input.cursor);
    if (cursor.meetingId !== input.meetingId)
        invalidInput("Transcript cursor does not match meeting");
    if (cursor.projection === "agent")
        invalidInput("Transcript cursor does not match projection");
    if (cursor.version !== meeting.transcriptVersion) {
        throw new MeetingRepositoryError("TRANSCRIPT_VERSION_CONFLICT", "Transcript cursor version changed");
    }
    if (meeting.committedStatus === null)
        invalidInput("Transcript cursor has no committed version");
    return cursor.lastSeq;
}
function anchoredSegment(meetingId, version, segment) {
    return { anchor: `${meetingId}@v${version}:${segment.seq}`, ...segment };
}
function loadTranscriptPage(database, meeting, afterSeq, limit) {
    if (meeting.committedStatus === null) {
        return {
            available: false,
            version: null,
            resultStatus: null,
            segments: [],
            nextCursor: null,
            totalSegments: 0,
        };
    }
    const countRow = database.prepare(`
    SELECT COUNT(*) AS segment_count FROM segments
    WHERE meeting_id = ? AND transcript_version = ?
  `).get(meeting.meetingId, meeting.transcriptVersion);
    const rows = database.prepare(`
    SELECT seq, start_ms, end_ms, speaker_label, text
    FROM segments
    WHERE meeting_id = ? AND transcript_version = ? AND seq > ?
    ORDER BY seq LIMIT ?
  `).all(meeting.meetingId, meeting.transcriptVersion, afterSeq, limit + 1);
    const segments = rows.slice(0, limit).map(parseSegmentRow)
        .map((segment) => anchoredSegment(meeting.meetingId, meeting.transcriptVersion, segment));
    const last = segments.at(-1);
    const nextCursor = rows.length > limit && last !== undefined
        ? encodeTranscriptCursor({
            meetingId: meeting.meetingId,
            version: meeting.transcriptVersion,
            lastSeq: last.seq,
            projection: "page",
        })
        : null;
    return {
        available: true,
        version: meeting.transcriptVersion,
        resultStatus: meeting.committedStatus,
        segments,
        nextCursor,
        totalSegments: countRow.segment_count,
    };
}
export function getMeetingPage(database, input) {
    requireMeetingId(input.meetingId);
    const limit = pageLimit(input.limit, DEFAULT_TRANSCRIPT_LIMIT, 200);
    if (input.cursor !== undefined && typeof input.cursor !== "string") {
        invalidInput("Pagination cursor is invalid");
    }
    return inReadTransaction(database, () => {
        const meeting = requiredMeeting(database, input.meetingId);
        const afterSeq = transcriptBoundary(input, meeting);
        return { meeting, transcript: loadTranscriptPage(database, meeting, afterSeq, limit) };
    });
}
export function getCommittedTranscriptSlice(database, input) {
    requireMeetingId(input.meetingId);
    if (!Number.isSafeInteger(input.afterSeq) || input.afterSeq < -1
        || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 1_024
        || (input.expectedVersion !== undefined
            && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))) {
        invalidInput("Committed transcript slice is invalid");
    }
    return inReadTransaction(database, () => loadCommittedTranscriptSlice(database, input));
}
export function getCommittedTranscriptSnapshot(database, meetingId) {
    requireMeetingId(meetingId);
    return inReadTransaction(database, () => {
        const meeting = requiredMeeting(database, meetingId);
        const rows = database.prepare(`
      SELECT seq, start_ms, end_ms, speaker_label, text FROM segments
      WHERE meeting_id = ? AND transcript_version = ? ORDER BY seq
    `).iterate(meetingId, meeting.transcriptVersion);
        const segments = [];
        let snapshotBytes = 2;
        for (const row of rows) {
            const segment = parseSegmentRow(row);
            snapshotBytes += Buffer.byteLength(JSON.stringify(segment))
                + (segments.length === 0 ? 0 : 1);
            if (snapshotBytes > MAX_TRANSCRIPT_SNAPSHOT_BYTES) {
                throw new MeetingRepositoryError("DATABASE_INTEGRITY_FAILED", "Committed transcript exceeds the snapshot boundary");
            }
            segments.push(segment);
        }
        return { meeting, segments };
    });
}
function loadCommittedTranscriptSlice(database, input) {
    const meeting = requiredMeeting(database, input.meetingId);
    if (input.expectedVersion !== undefined && input.expectedVersion !== meeting.transcriptVersion) {
        throw new MeetingRepositoryError("TRANSCRIPT_VERSION_CONFLICT", "Transcript version changed");
    }
    if (meeting.committedStatus === null) {
        return {
            meeting,
            available: false,
            version: null,
            resultStatus: null,
            segments: [],
            totalSegments: 0,
        };
    }
    const countRow = database.prepare(`
    SELECT COUNT(*) AS segment_count FROM segments
    WHERE meeting_id = ? AND transcript_version = ?
  `).get(meeting.meetingId, meeting.transcriptVersion);
    const rows = database.prepare(`
    SELECT seq, start_ms, end_ms, speaker_label, text FROM segments
    WHERE meeting_id = ? AND transcript_version = ? AND seq > ?
    ORDER BY seq LIMIT ?
  `).all(meeting.meetingId, meeting.transcriptVersion, input.afterSeq, input.limit);
    return {
        meeting,
        available: true,
        version: meeting.transcriptVersion,
        resultStatus: meeting.committedStatus,
        segments: rows.map(parseSegmentRow)
            .map((segment) => anchoredSegment(meeting.meetingId, meeting.transcriptVersion, segment)),
        totalSegments: countRow.segment_count,
    };
}
function boundarySql(boundary) {
    return boundary === null ? "" : `
    AND (m.created_at_ms < ? OR (m.created_at_ms = ? AND m.meeting_id < ?))
  `;
}
function matchSql(mode) {
    if (mode === "recent")
        return "";
    const predicate = mode === "like"
        ? "s.text LIKE ? ESCAPE '\\'"
        : "segments_fts MATCH ?";
    const ftsJoin = mode === "fts"
        ? "JOIN segments_fts ON segments_fts.rowid = s.segment_pk"
        : "";
    return `
    AND m.committed_status IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM segments s
      ${ftsJoin}
      WHERE s.meeting_id = m.meeting_id
        AND s.transcript_version = m.transcript_version
        AND ${predicate}
    )
  `;
}
function meetingQueryArguments(parameters) {
    const values = [];
    if (parameters.matchValue !== null)
        values.push(parameters.matchValue);
    if (parameters.boundary !== null) {
        values.push(parameters.boundary.createdAtMs, parameters.boundary.createdAtMs, parameters.boundary.meetingId);
    }
    values.push(parameters.limit + 1);
    return values;
}
function selectSearchMeetings(database, parameters) {
    const statement = database.prepare(`
    SELECT m.* FROM meetings m
    WHERE m.status <> 'deleting'
    ${matchSql(parameters.mode)}
    ${boundarySql(parameters.boundary)}
    ORDER BY m.created_at_ms DESC, m.meeting_id DESC
    LIMIT ?
  `);
    return statement.all(...meetingQueryArguments(parameters)).map(parseMeetingRow);
}
function hitStatement(database, mode) {
    const ftsJoin = mode === "fts"
        ? "JOIN segments_fts ON segments_fts.rowid = s.segment_pk"
        : "";
    const predicate = mode === "like"
        ? "s.text LIKE ? ESCAPE '\\'"
        : "segments_fts MATCH ?";
    return database.prepare(`
    SELECT s.seq, s.start_ms, s.end_ms, s.speaker_label, s.text
    FROM segments s
    ${ftsJoin}
    WHERE s.meeting_id = ? AND s.transcript_version = ? AND ${predicate}
    ORDER BY s.seq LIMIT 3
  `);
}
function snippet(text, query) {
    const characters = Array.from(text);
    if (characters.length <= MAX_SNIPPET_CHARACTERS)
        return text;
    let codeUnitIndex = text.indexOf(query);
    if (codeUnitIndex < 0) {
        codeUnitIndex = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    }
    const matchIndex = codeUnitIndex < 0 ? 0 : Array.from(text.slice(0, codeUnitIndex)).length;
    const queryLength = Math.min(Array.from(query).length, MAX_SNIPPET_CHARACTERS);
    const start = Math.max(0, matchIndex - Math.floor((MAX_SNIPPET_CHARACTERS - queryLength) / 2));
    return characters.slice(start, start + MAX_SNIPPET_CHARACTERS).join("");
}
function searchHits(statement, meeting, parameters) {
    const rows = statement.all(meeting.meetingId, meeting.transcriptVersion, parameters.matchValue);
    return rows.map(parseSegmentRow).map((segment) => ({
        anchor: `${meeting.meetingId}@v${meeting.transcriptVersion}:${segment.seq}`,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speakerLabel: segment.speakerLabel,
        snippet: snippet(segment.text, parameters.query),
    }));
}
function searchItems(database, meetings, parameters) {
    const statement = parameters.mode === "recent" ? null : hitStatement(database, parameters.mode);
    return meetings.map((meeting) => ({
        meetingId: meeting.meetingId,
        origin: meeting.origin,
        title: meeting.title,
        createdAtMs: meeting.createdAtMs,
        durationMs: meeting.durationMs,
        status: meeting.status,
        transcriptVersion: meeting.transcriptVersion,
        hits: statement === null ? [] : searchHits(statement, meeting, parameters),
    }));
}
function nextSearchCursor(items, hasMore, queryHash) {
    const last = items.at(-1);
    return hasMore && last !== undefined
        ? encodeSearchCursor({
            queryHash,
            createdAtMs: last.createdAtMs,
            meetingId: last.meetingId,
        })
        : null;
}
export function searchMeetings(database, input) {
    if (input.cursor !== undefined && typeof input.cursor !== "string") {
        invalidInput("Pagination cursor is invalid");
    }
    const parameters = searchParameters(input);
    return inReadTransaction(database, () => {
        const candidates = selectSearchMeetings(database, parameters);
        const meetings = candidates.slice(0, parameters.limit);
        const items = searchItems(database, meetings, parameters);
        return {
            items,
            nextCursor: nextSearchCursor(items, candidates.length > parameters.limit, parameters.queryHash),
        };
    });
}
//# sourceMappingURL=meeting-query.js.map