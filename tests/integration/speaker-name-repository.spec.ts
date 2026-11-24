import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { afterEach, expect, it } from "vitest";

import { openMeetingDatabase } from "../../src/storage/database.js";
import {
  openMeetingRepository,
  type MeetingRepository,
} from "../../src/storage/meeting-repository.js";
import {
  createSpeakerNameRepository,
  type MeetingSpeakerName,
  type SpeakerNameRepository,
} from "../../src/storage/speaker-name-repository.js";

const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_MEETING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNKNOWN_MEETING_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const IMPORT_RUN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_RUN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

interface Fixture {
  readonly database: DatabaseSync;
  readonly names: SpeakerNameRepository;
  readonly meetings: MeetingRepository;
}

const roots: string[] = [];
const databases: DatabaseSync[] = [];
const repositories: MeetingRepository[] = [];

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dsh-asr-speaker-names-"));
  roots.push(root);
  const filename = join(root, "meetings.sqlite3");
  const meetings = openMeetingRepository(filename);
  repositories.push(meetings);
  for (const [meetingId, runId] of [
    [MEETING_ID, IMPORT_RUN_ID],
    [OTHER_MEETING_ID, OTHER_RUN_ID],
  ] as const) {
    meetings.createImport({
      meetingId,
      title: "Speaker name meeting",
      sourceName: "speaker-name.wav",
      sourceFormat: "wav",
      sourceSizeBytes: 1_024,
      runId,
      nowMs: 1_000,
    });
    meetings.commitTranscript({
      meetingId,
      runId,
      baseVersion: 0,
      resultStatus: "completed",
      resultReason: null,
      durationMs: 5_000,
      engineFingerprint: "a".repeat(64),
      segments: [
        { seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "synthetic" },
      ],
      nowMs: 2_000,
    });
  }
  const database = openMeetingDatabase(filename);
  databases.push(database);
  return {
    database,
    names: createSpeakerNameRepository(database),
    meetings,
  };
}

afterEach(async () => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) await rm(root, { recursive: true });
});

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to throw");
}

function assigned(
  meetingId: string,
  label: string,
  name: string,
): MeetingSpeakerName {
  return { meetingId, label, name };
}

it("creates the speaker names table at schema version 6", async () => {
  const fixture = await createFixture();
  const version = fixture.database.prepare("PRAGMA user_version").get() as Record<string, unknown>;
  const table = fixture.database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'meeting_speaker_names'
  `).get() as Record<string, unknown>;
  expect(version.user_version).toBe(6);
  expect(table.sql).toContain("PRIMARY KEY (meeting_id, label)");
  expect(table.sql).toContain("ON DELETE CASCADE");
  expect(table.sql).toContain("STRICT");
  expect(fixture.names.list(MEETING_ID)).toEqual([]);
});

it("round-trips names ordered by label and replaces the whole snapshot", async () => {
  const { names } = await createFixture();

  names.replace(MEETING_ID, [
    assigned(MEETING_ID, "Speaker C", "Grace Hopper"),
    assigned(MEETING_ID, "Speaker A", "Ada Lovelace"),
    assigned(MEETING_ID, "Speaker B", "Alan Turing"),
  ]);
  expect(names.list(MEETING_ID)).toEqual([
    { meetingId: MEETING_ID, label: "Speaker A", name: "Ada Lovelace" },
    { meetingId: MEETING_ID, label: "Speaker B", name: "Alan Turing" },
    { meetingId: MEETING_ID, label: "Speaker C", name: "Grace Hopper" },
  ]);

  // A second save drops the names it does not mention.
  names.replace(MEETING_ID, [assigned(MEETING_ID, "Speaker B", "Alan M. Turing")]);
  expect(names.list(MEETING_ID)).toEqual([
    { meetingId: MEETING_ID, label: "Speaker B", name: "Alan M. Turing" },
  ]);

  // An empty array clears the meeting.
  names.replace(MEETING_ID, []);
  expect(names.list(MEETING_ID)).toEqual([]);
});

it("scopes a replacement to its own meeting", async () => {
  const { names } = await createFixture();

  names.replace(MEETING_ID, [assigned(MEETING_ID, "Speaker A", "Ada Lovelace")]);
  names.replace(OTHER_MEETING_ID, [
    assigned(OTHER_MEETING_ID, "Speaker A", "Grace Hopper"),
  ]);
  names.replace(MEETING_ID, [assigned(MEETING_ID, "Speaker A", "Ada Byron")]);

  expect(names.list(MEETING_ID)).toEqual([
    { meetingId: MEETING_ID, label: "Speaker A", name: "Ada Byron" },
  ]);
  expect(names.list(OTHER_MEETING_ID)).toEqual([
    { meetingId: OTHER_MEETING_ID, label: "Speaker A", name: "Grace Hopper" },
  ]);
});

it("cascades names when the meeting is deleted", async () => {
  const fixture = await createFixture();
  const { names, meetings, database } = fixture;

  names.replace(MEETING_ID, [assigned(MEETING_ID, "Speaker A", "Ada Lovelace")]);
  names.replace(OTHER_MEETING_ID, [
    assigned(OTHER_MEETING_ID, "Speaker A", "Grace Hopper"),
  ]);

  meetings.beginDeletion({ meetingId: MEETING_ID, expectedVersion: 1, nowMs: 30_000 });
  meetings.completeDeletion({ meetingId: MEETING_ID, expectedVersion: 1 });

  expect(database.prepare(`
    SELECT meeting_id, label, name FROM meeting_speaker_names
  `).all()).toEqual([
    { meeting_id: OTHER_MEETING_ID, label: "Speaker A", name: "Grace Hopper" },
  ]);
  expect(captureError(() => names.list(MEETING_ID)))
    .toMatchObject({ code: "MEETING_NOT_FOUND" });
});

it("rejects unknown meetings and leaves the stored names untouched on invalid input", async () => {
  const { names } = await createFixture();

  expect(captureError(() => names.replace(UNKNOWN_MEETING_ID, [])))
    .toMatchObject({ code: "MEETING_NOT_FOUND" });
  expect(captureError(() => names.replace(UNKNOWN_MEETING_ID, [
    assigned(UNKNOWN_MEETING_ID, "Speaker A", "Ada Lovelace"),
  ]))).toMatchObject({ code: "MEETING_NOT_FOUND" });
  expect(captureError(() => names.list(UNKNOWN_MEETING_ID)))
    .toMatchObject({ code: "MEETING_NOT_FOUND" });
  expect(captureError(() => names.list("not-a-meeting-id")))
    .toMatchObject({ code: "INVALID_INPUT" });

  names.replace(MEETING_ID, [assigned(MEETING_ID, "Speaker A", "Ada Lovelace")]);
  const baseline = names.list(MEETING_ID);

  const invalidSnapshots: readonly (readonly MeetingSpeakerName[])[] = [
    [assigned(MEETING_ID, "", "Ada Lovelace")],
    [assigned(MEETING_ID, "Speaker A", "")],
    [assigned(MEETING_ID, "Speaker A", "   ")],
    [assigned(MEETING_ID, "Speaker A", " Ada  Lovelace ")],
    [assigned(MEETING_ID, "Speaker A", "Ada\nLovelace")],
    [assigned(MEETING_ID, "A".repeat(121), "Ada Lovelace")],
    [
      assigned(MEETING_ID, "Speaker A", "Ada Lovelace"),
      assigned(MEETING_ID, "Speaker A", "Grace Hopper"),
    ],
    [assigned(OTHER_MEETING_ID, "Speaker A", "Ada Lovelace")],
  ];
  for (const snapshot of invalidSnapshots) {
    expect(captureError(() => names.replace(MEETING_ID, snapshot)))
      .toMatchObject({ code: "INVALID_INPUT" });
    expect(names.list(MEETING_ID)).toEqual(baseline);
  }
});
