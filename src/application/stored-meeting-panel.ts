import type {
  OkfIngestRpcValue,
  StoredMeetingRpcEntry,
  StoredMeetingTranscriptRpcValue,
} from "../recording/rpc-contract.js";
import { MeetingRepositoryError } from "../storage/errors.js";
import type { MeetingRepository, MeetingRecord } from "../storage/meeting-repository.js";
import type { OkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
import type { SpeakerNameRepository } from "../storage/speaker-name-repository.js";
import { speakerNameFor } from "../transcripts/speaker-attribution.js";
import { TranscriptProjectionError } from "../transcript-projection/transcript-export-error.js";

export const DEFAULT_STORED_MEETINGS_LIMIT = 20;
export const MAX_STORED_MEETINGS_LIMIT = 50;

/**
 * How far back a list entry looks for the version already in the bundle: the
 * repository's page cap. Older successes stay visible through `okf/ingest/status`.
 */
const MAX_INGESTION_ATTEMPTS = 100;

/** An ingestion attempt as the storage layer reports it. */
type OkfIngestionAttempt = NonNullable<ReturnType<OkfIngestionRepository["findLatestForMeeting"]>>;

export interface StoredMeetingPanelOptions {
  readonly meetings: Pick<MeetingRepository, "getCommittedTranscriptSnapshot" | "listStoredMeetings">;
  readonly ingestion: Pick<OkfIngestionRepository, "findLatestForMeeting" | "listForMeeting">;
  readonly speakerNames: Pick<SpeakerNameRepository, "list">;
}

/**
 * Read model behind the panel's stored-meeting endpoints.
 *
 * It joins committed transcripts, speaker attribution and OKF ingestion state,
 * and performs no writes: the panel only ever reads back what processing already
 * committed.
 */
export interface StoredMeetingPanel {
  list(limit?: number): readonly StoredMeetingRpcEntry[];
  transcript(meetingId: string): StoredMeetingTranscriptRpcValue;
  ingestionStatus(meetingId: string): OkfIngestRpcValue;
}

function storedLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_STORED_MEETINGS_LIMIT;
  if (!Number.isSafeInteger(limit)
    || limit < 1 || limit > MAX_STORED_MEETINGS_LIMIT) {
    throw new MeetingRepositoryError("INVALID_INPUT", "Stored meeting limit is invalid");
  }
  return limit;
}

/** Version the bundle already holds, newest successful attempt first. */
function ingestedVersion(attempts: readonly OkfIngestionAttempt[]): number | null {
  return attempts.find((attempt) => attempt.state === "succeeded")?.transcriptVersion ?? null;
}

function storedMeetingEntry(
  meeting: MeetingRecord,
  ingestedTranscriptVersion: number | null,
): StoredMeetingRpcEntry {
  if (meeting.committedStatus !== "completed" && meeting.committedStatus !== "partial") {
    throw new MeetingRepositoryError(
      "DATABASE_INTEGRITY_FAILED",
      "Stored meeting has no committed transcript",
    );
  }
  return {
    meeting_id: meeting.meetingId,
    title: meeting.title,
    started_at: meeting.recordingStartedAtMs === null
      ? null
      : new Date(meeting.recordingStartedAtMs).toISOString(),
    duration_ms: meeting.durationMs,
    transcript_version: meeting.transcriptVersion,
    status: meeting.committedStatus,
    ingested_transcript_version: ingestedTranscriptVersion,
  };
}

function okfIngestValue(attempt: OkfIngestionAttempt | undefined): OkfIngestRpcValue {
  if (attempt === undefined) {
    return {
      job_id: null,
      state: "idle",
      transcript_version: null,
      error_code: null,
      message: null,
    };
  }
  return {
    job_id: null,
    state: attempt.state,
    transcript_version: attempt.transcriptVersion,
    error_code: attempt.errorCode ?? null,
    message: attempt.errorMessage ?? null,
  };
}

export function createStoredMeetingPanel(options: StoredMeetingPanelOptions): StoredMeetingPanel {
  return {
    list(limit?: number): readonly StoredMeetingRpcEntry[] {
      return options.meetings.listStoredMeetings(storedLimit(limit)).map((meeting) => {
        const attempts = options.ingestion.listForMeeting(meeting.meetingId, MAX_INGESTION_ATTEMPTS);
        return storedMeetingEntry(meeting, ingestedVersion(attempts));
      });
    },

    transcript(meetingId: string): StoredMeetingTranscriptRpcValue {
      const snapshot = options.meetings.getCommittedTranscriptSnapshot(meetingId);
      const meeting = snapshot.meeting;
      if (meeting.committedStatus === null) {
        throw new TranscriptProjectionError(
          "TRANSCRIPT_NOT_COMMITTED",
          "Meeting has no committed transcript",
        );
      }
      if (meeting.committedStatus === "empty" || snapshot.segments.length === 0) {
        throw new TranscriptProjectionError("TRANSCRIPT_EMPTY", "Committed transcript is empty");
      }
      const names: Record<string, string> = {};
      for (const entry of options.speakerNames.list(meetingId)) {
        names[entry.label] = entry.name;
      }
      return {
        meeting_id: meeting.meetingId,
        title: meeting.title,
        transcript_version: meeting.transcriptVersion,
        duration_ms: meeting.durationMs,
        segments: snapshot.segments.map((segment) => ({
          seq: segment.seq,
          startMs: segment.startMs,
          endMs: segment.endMs,
          speakerLabel: speakerNameFor(segment.speakerLabel, names),
          text: segment.text,
        })),
      };
    },

    ingestionStatus(meetingId: string): OkfIngestRpcValue {
      return okfIngestValue(options.ingestion.findLatestForMeeting(meetingId));
    },
  };
}
