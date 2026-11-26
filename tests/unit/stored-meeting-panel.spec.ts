import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { afterEach, expect, it } from "vitest";

import {
  createStoredMeetingPanel,
  DEFAULT_STORED_MEETINGS_LIMIT,
  type StoredMeetingPanel,
} from "../../src/application/stored-meeting-panel.js";
import { openMeetingDatabase } from "../../src/storage/database.js";
import {
  openMeetingRepository,
  type MeetingRepository,
} from "../../src/storage/meeting-repository.js";
import {
  createOkfIngestionRepository,
  type OkfIngestionRepository,
} from "../../src/storage/okf-ingestion-repository.js";
import {
  createSpeakerNameRepository,
  type SpeakerNameRepository,
} from "../../src/storage/speaker-name-repository.js";

const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_MEETING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THIRD_MEETING_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PENDING_MEETING_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNKNOWN_MEETING_ID = "99999999-9999-4999-8999-999999999999";
const IMPORT_RUN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

interface Fixture {
  readonly panel: StoredMeetingPanel;
  readonly meetings: MeetingRepository;
  readonly ingestion: OkfIngestionRepository;
  readonly speakerNames: SpeakerNameRepository;
  readonly database: DatabaseSync;
  readonly root: string;
}

const repositories: MeetingRepository[] = [];
const databases: DatabaseSync[] = [];
const roots: string[] = [];

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dsh-asr-stored-meeting-panel-"));
  roots.push(root);
  const filename = join(root, "meetings.sqlite3");
  const meetings = openMeetingRepository(filename);
  repositories.push(meetings);
  const database = openMeetingDatabase(filename);
  databases.push(database);
  const ingestion = createOkfIngestionRepository(database);
  const speakerNames = createSpeakerNameRepository(database);
  const panel = createStoredMeetingPanel({ meetings, ingestion, speakerNames });
  return { panel, meetings, ingestion, speakerNames, database, root };
}

function importMeeting(meetings: MeetingRepository, meetingId: string, title: string, nowMs: number): void {
  meetings.createImport({
    meetingId,
    title,
    sourceName: `${meetingId}.wav`,
    sourceFormat: "wav",
    sourceSizeBytes: 1_024,
    runId: IMPORT_RUN_ID,
    nowMs,
  });
}

function commitTranscript(
  meetings: MeetingRepository,
  meetingId: string,
  resultStatus: "completed" | "partial" | "empty",
  segments: readonly {
    readonly seq: number;
    readonly startMs: number;
    readonly endMs: number;
    readonly speakerLabel: string;
    readonly text: string;
  }[],
  nowMs: number,
  durationMs = 60_000,
): void {
  meetings.commitTranscript({
    meetingId,
    runId: IMPORT_RUN_ID,
    baseVersion: 0,
    resultStatus,
    resultReason: resultStatus === "completed"
      ? null
      : resultStatus === "partial" ? "unknown_speaker_segments" : "silent",
    durationMs,
    engineFingerprint: "a".repeat(64),
    segments,
    nowMs,
  });
}

function captureCode(operation: () => unknown): string | undefined {
  try {
    operation();
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string" ? error.code : undefined;
  }
  throw new Error("Expected the operation to throw");
}

afterEach(async () => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) await rm(root, { recursive: true });
});

it("lists only committed meetings newest first and honors the limit", async () => {
  const fixture = await createFixture();
  const { meetings, panel } = fixture;
  importMeeting(meetings, OTHER_MEETING_ID, "旧会议", 1_000);
  commitTranscript(meetings, OTHER_MEETING_ID, "completed",
    [{ seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "first" }], 1_100);
  importMeeting(meetings, THIRD_MEETING_ID, "空白会议", 2_000);
  commitTranscript(meetings, THIRD_MEETING_ID, "empty", [], 2_100);
  importMeeting(meetings, MEETING_ID, "部分会议", 3_000);
  commitTranscript(meetings, MEETING_ID, "partial",
    [{ seq: 0, startMs: 0, endMs: 2_000, speakerLabel: "UNKNOWN", text: "second" }], 3_100, 5_000);
  importMeeting(meetings, PENDING_MEETING_ID, "未提交会议", 4_000);

  expect(panel.list()).toEqual([
    {
      meeting_id: MEETING_ID,
      title: "部分会议",
      started_at: null,
      duration_ms: 5_000,
      transcript_version: 1,
      status: "partial",
      ingested_transcript_version: null,
    },
    {
      meeting_id: OTHER_MEETING_ID,
      title: "旧会议",
      started_at: null,
      duration_ms: 60_000,
      transcript_version: 1,
      status: "completed",
      ingested_transcript_version: null,
    },
  ]);
  expect(panel.list(DEFAULT_STORED_MEETINGS_LIMIT)).toHaveLength(2);
  expect(panel.list(1)).toHaveLength(1);
  expect(panel.list(1)[0]?.meeting_id).toBe(MEETING_ID);
  expect(() => panel.list(0)).toThrowError("Stored meeting limit is invalid");
  expect(() => panel.list(51)).toThrowError("Stored meeting limit is invalid");
});

it("reports the ingested version only for the newest succeeded attempt", async () => {
  const fixture = await createFixture();
  const { meetings, ingestion, panel, root } = fixture;
  importMeeting(meetings, MEETING_ID, "周会", 1_000);
  commitTranscript(meetings, MEETING_ID, "completed",
    [{ seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "first" }], 1_100);

  expect(panel.ingestionStatus(MEETING_ID)).toEqual({
    job_id: null, state: "idle", transcript_version: null, error_code: null, message: null,
  });
  expect(panel.list()[0]?.ingested_transcript_version).toBeNull();

  ingestion.beginAttempt({
    meetingId: MEETING_ID, transcriptVersion: 1, directory: join(root, "bundle"), startedAtMs: 10_000,
  });
  expect(panel.ingestionStatus(MEETING_ID)).toEqual({
    job_id: null, state: "running", transcript_version: 1, error_code: null, message: null,
  });
  expect(panel.list()[0]?.ingested_transcript_version).toBeNull();

  ingestion.finishAttempt({
    meetingId: MEETING_ID, transcriptVersion: 1, directory: join(root, "bundle"),
    state: "succeeded", finishedAtMs: 11_000,
  });
  expect(panel.list()[0]?.ingested_transcript_version).toBe(1);
  expect(panel.ingestionStatus(MEETING_ID)).toMatchObject({ state: "succeeded", transcript_version: 1 });

  ingestion.beginAttempt({
    meetingId: MEETING_ID, transcriptVersion: 1, directory: join(root, "other"), startedAtMs: 12_000,
  });
  ingestion.finishAttempt({
    meetingId: MEETING_ID, transcriptVersion: 1, directory: join(root, "other"),
    state: "failed", finishedAtMs: 13_000, errorCode: "OKF_GIT_FAILED", errorMessage: "OKF commit failed",
  });
  expect(panel.list()[0]?.ingested_transcript_version).toBe(1);
  expect(panel.ingestionStatus(MEETING_ID)).toEqual({
    job_id: null, state: "failed", transcript_version: 1,
    error_code: "OKF_GIT_FAILED", message: "OKF commit failed",
  });
});

it("attributes committed segments and mirrors the export rejections", async () => {
  const fixture = await createFixture();
  const { meetings, speakerNames, panel } = fixture;
  importMeeting(meetings, MEETING_ID, "周会", 1_000);
  commitTranscript(meetings, MEETING_ID, "completed", [
    { seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "first" },
    { seq: 1, startMs: 1_000, endMs: 2_000, speakerLabel: "Speaker B", text: "second" },
  ], 1_100);
  speakerNames.replace(MEETING_ID, [{ meetingId: MEETING_ID, label: "Speaker A", name: "Erwin" }]);

  expect(panel.transcript(MEETING_ID)).toEqual({
    meeting_id: MEETING_ID,
    title: "周会",
    transcript_version: 1,
    duration_ms: 60_000,
    segments: [
      { seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Erwin", text: "first" },
      { seq: 1, startMs: 1_000, endMs: 2_000, speakerLabel: "Speaker B", text: "second" },
    ],
  });

  importMeeting(meetings, THIRD_MEETING_ID, "空白会议", 2_000);
  commitTranscript(meetings, THIRD_MEETING_ID, "empty", [], 2_100);
  expect(captureCode(() => panel.transcript(THIRD_MEETING_ID))).toBe("TRANSCRIPT_EMPTY");

  importMeeting(meetings, PENDING_MEETING_ID, "未提交会议", 3_000);
  expect(captureCode(() => panel.transcript(PENDING_MEETING_ID))).toBe("TRANSCRIPT_NOT_COMMITTED");
  expect(captureCode(() => panel.transcript(UNKNOWN_MEETING_ID))).toBe("MEETING_NOT_FOUND");
});
