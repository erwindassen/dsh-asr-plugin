import { normalizeSpeakerName } from "../transcripts/speaker-attribution.js";
import { inReadOperation, inWriteTransaction } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_LABEL_LENGTH = 120;
function invalidInput(message) {
    throw new MeetingRepositoryError("INVALID_INPUT", message);
}
function validateMeetingId(meetingId) {
    if (!UUID_PATTERN.test(meetingId))
        invalidInput("Meeting id is invalid");
}
function requireCanonicalName(name) {
    if (name.length < 1 || normalizeSpeakerName(name) !== name) {
        invalidInput("Speaker name is invalid");
    }
}
function validateSpeakerNames(meetingId, names) {
    const labels = new Set();
    for (const entry of names) {
        if (entry.meetingId !== meetingId) {
            invalidInput("Speaker name does not belong to the meeting");
        }
        if (entry.label.length < 1 || entry.label.length > MAX_LABEL_LENGTH) {
            invalidInput("Speaker label is invalid");
        }
        if (labels.has(entry.label))
            invalidInput("Speaker label is duplicated");
        labels.add(entry.label);
        requireCanonicalName(entry.name);
    }
}
function requireString(value, name) {
    if (typeof value !== "string")
        throw new Error(`Invalid ${name}`);
    return value;
}
function meetingSpeakerNameFromRow(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Invalid speaker name row");
    }
    const row = value;
    return {
        meetingId: requireString(row.meeting_id, "meeting_id"),
        label: requireString(row.label, "label"),
        name: requireString(row.name, "name"),
    };
}
class SqliteSpeakerNameRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    list(meetingId) {
        validateMeetingId(meetingId);
        return inReadOperation(() => {
            this.requireMeeting(meetingId);
            return this.database.prepare(`
        SELECT meeting_id, label, name FROM meeting_speaker_names
        WHERE meeting_id = ?
        ORDER BY label
      `).all(meetingId).map(meetingSpeakerNameFromRow);
        });
    }
    replace(meetingId, names) {
        validateMeetingId(meetingId);
        validateSpeakerNames(meetingId, names);
        inWriteTransaction(this.database, () => {
            this.requireMeeting(meetingId);
            this.database.prepare("DELETE FROM meeting_speaker_names WHERE meeting_id = ?").run(meetingId);
            if (names.length === 0)
                return;
            const insert = this.database.prepare(`
        INSERT INTO meeting_speaker_names (meeting_id, label, name) VALUES (?, ?, ?)
      `);
            for (const entry of names) {
                insert.run(meetingId, entry.label, entry.name);
            }
        });
    }
    requireMeeting(meetingId) {
        const row = this.database.prepare("SELECT 1 AS found FROM meetings WHERE meeting_id = ?").get(meetingId);
        if (row === undefined) {
            throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
        }
    }
}
export function createSpeakerNameRepository(database) {
    return new SqliteSpeakerNameRepository(database);
}
//# sourceMappingURL=speaker-name-repository.js.map