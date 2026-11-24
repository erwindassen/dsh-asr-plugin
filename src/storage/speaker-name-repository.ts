import type { DatabaseSync } from "node:sqlite";

import { normalizeSpeakerName } from "../transcripts/speaker-attribution.js";
import { inReadOperation, inWriteTransaction } from "./database.js";
import { MeetingRepositoryError } from "./errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_LABEL_LENGTH = 120;

/** One user-assigned display name for one speaker label of one meeting. */
export interface MeetingSpeakerName {
  readonly meetingId: string;
  readonly label: string;
  readonly name: string;
}

/**
 * Persistence for per-meeting speaker names.
 *
 * The repository borrows the caller's database connection and never closes it.
 * Names are a presentation overlay: a committed transcript keeps its labels, and
 * rows cascade with the meeting. `replace` is the only write, so a saved form is
 * one atomic snapshot and an empty array clears the meeting's names.
 */
export interface SpeakerNameRepository {
  /**
   * Names of one meeting ordered by label. A missing meeting is reported as
   * `MEETING_NOT_FOUND` rather than as an empty list.
   */
  list(meetingId: string): readonly MeetingSpeakerName[];
  /** Replaces every name of one meeting in a single transaction. */
  replace(meetingId: string, names: readonly MeetingSpeakerName[]): void;
}

function invalidInput(message: string): never {
  throw new MeetingRepositoryError("INVALID_INPUT", message);
}

function validateMeetingId(meetingId: string): void {
  if (!UUID_PATTERN.test(meetingId)) invalidInput("Meeting id is invalid");
}

function requireCanonicalName(name: string): void {
  if (name.length < 1 || normalizeSpeakerName(name) !== name) {
    invalidInput("Speaker name is invalid");
  }
}

function validateSpeakerNames(
  meetingId: string,
  names: readonly MeetingSpeakerName[],
): void {
  const labels = new Set<string>();
  for (const entry of names) {
    if (entry.meetingId !== meetingId) {
      invalidInput("Speaker name does not belong to the meeting");
    }
    if (entry.label.length < 1 || entry.label.length > MAX_LABEL_LENGTH) {
      invalidInput("Speaker label is invalid");
    }
    if (labels.has(entry.label)) invalidInput("Speaker label is duplicated");
    labels.add(entry.label);
    requireCanonicalName(entry.name);
  }
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${name}`);
  return value;
}

function meetingSpeakerNameFromRow(value: unknown): MeetingSpeakerName {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid speaker name row");
  }
  const row = value as Record<string, unknown>;
  return {
    meetingId: requireString(row.meeting_id, "meeting_id"),
    label: requireString(row.label, "label"),
    name: requireString(row.name, "name"),
  };
}

class SqliteSpeakerNameRepository implements SpeakerNameRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(meetingId: string): readonly MeetingSpeakerName[] {
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

  replace(meetingId: string, names: readonly MeetingSpeakerName[]): void {
    validateMeetingId(meetingId);
    validateSpeakerNames(meetingId, names);
    inWriteTransaction(this.database, () => {
      this.requireMeeting(meetingId);
      this.database.prepare(
        "DELETE FROM meeting_speaker_names WHERE meeting_id = ?",
      ).run(meetingId);
      if (names.length === 0) return;
      const insert = this.database.prepare(`
        INSERT INTO meeting_speaker_names (meeting_id, label, name) VALUES (?, ?, ?)
      `);
      for (const entry of names) {
        insert.run(meetingId, entry.label, entry.name);
      }
    });
  }

  private requireMeeting(meetingId: string): void {
    const row = this.database.prepare(
      "SELECT 1 AS found FROM meetings WHERE meeting_id = ?",
    ).get(meetingId);
    if (row === undefined) {
      throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
    }
  }
}

export function createSpeakerNameRepository(database: DatabaseSync): SpeakerNameRepository {
  return new SqliteSpeakerNameRepository(database);
}
