import { stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { MeetingRecord } from "../storage/types.js";
import { TranscriptProjectionError } from "../transcript-projection/transcript-export-error.js";
import type { ExportCommittedTranscriptInput, TranscriptExportReceipt } from "../transcript-projection/transcript-projection.js";
import { PickerError, type DirectoryPicker } from "./directory-picker.js";
import { transcriptExportFileName } from "./export-filename.js";
import {
  assignedSpeakerNames,
  speakerNameProblems,
  type SpeakerNameMap,
  type SpeakerNameProblem,
} from "./speaker-attribution.js";
import type { TranscriptExportControl, TranscriptExportOutcome, TranscriptExportRequest } from "./transcript-export-contract.js";

export interface TranscriptExportMeetingSource {
  exportTranscript(input: ExportCommittedTranscriptInput): Promise<TranscriptExportReceipt>;
  getMeetingRecord(meetingId: string): MeetingRecord;
  /** Distinct labels of the committed transcript this export would read. */
  getCommittedSpeakerLabels(meetingId: string): readonly string[];
}

export interface TranscriptExportControlOptions {
  /** Configured default folder; empty means "not configured yet". */
  readonly directory: () => string;
  readonly meeting: TranscriptExportMeetingSource;
  readonly picker: DirectoryPicker;
  readonly pickerPrompt: () => string;
}

type UnknownLabelProblem = Extract<SpeakerNameProblem, { kind: "unknown-label" }>;
type InvalidNameProblem = Extract<SpeakerNameProblem, { kind: "invalid-name" }>;
type DuplicateNameProblem = Extract<SpeakerNameProblem, { kind: "duplicate-name" }>;

/**
 * Rejects a name map before any directory resolution or write. Only assigned
 * names travel onward, so an identity map exports exactly the labels.
 */
function validatedSpeakerNames(
  source: TranscriptExportMeetingSource,
  request: TranscriptExportRequest,
): SpeakerNameMap | undefined {
  if (request.speakerNames === undefined) return undefined;
  const labels = Object.keys(request.speakerNames).length === 0
    ? []
    : source.getCommittedSpeakerLabels(request.meetingId);
  const problems = speakerNameProblems(labels, request.speakerNames);
  const unknown = problems.find(
    (problem): problem is UnknownLabelProblem => problem.kind === "unknown-label",
  );
  if (unknown !== undefined) {
    throw new TranscriptProjectionError("EXPORT_SPEAKER_UNKNOWN", `Unknown speaker label: ${unknown.label}`);
  }
  const invalid = problems.find(
    (problem): problem is InvalidNameProblem => problem.kind === "invalid-name",
  );
  if (invalid !== undefined) {
    throw new TranscriptProjectionError(
      "EXPORT_SPEAKER_INVALID",
      `Speaker name for label "${invalid.label}" is not in canonical form`,
    );
  }
  const duplicate = problems.find(
    (problem): problem is DuplicateNameProblem => problem.kind === "duplicate-name",
  );
  if (duplicate !== undefined) {
    throw new TranscriptProjectionError(
      "EXPORT_SPEAKER_DUPLICATE",
      `Speaker name "${duplicate.name}" is assigned to more than one label`,
    );
  }
  return assignedSpeakerNames(labels, request.speakerNames);
}

async function requireDirectory(path: string): Promise<string> {
  if (path.trim() === "") {
    throw new TranscriptProjectionError("EXPORT_DIRECTORY_REQUIRED", "Choose a transcript folder first");
  }
  if (!isAbsolute(path)) {
    throw new TranscriptProjectionError("EXPORT_DIRECTORY_INVALID", "Transcript folder must be an absolute path");
  }
  const info = await stat(path).catch(() => null);
  if (info === null || !info.isDirectory()) {
    throw new TranscriptProjectionError("EXPORT_DIRECTORY_INVALID", "Transcript folder does not exist");
  }
  return path;
}

export function createTranscriptExportControl(options: TranscriptExportControlOptions): TranscriptExportControl {
  const chooseDirectory = async (signal?: AbortSignal): Promise<string | null> => {
    try {
      return await options.picker.choose({ prompt: options.pickerPrompt(), ...(signal === undefined ? {} : { signal }) });
    } catch (error) {
      if (error instanceof PickerError) {
        if (error.kind === "cancelled") {
          throw new TranscriptProjectionError("CANCELLED_BY_USER", "Folder selection was cancelled");
        }
        throw new TranscriptProjectionError("EXPORT_PICKER_FAILED", "Transcript folder picker failed", { cause: error });
      }
      throw error;
    }
  };

  return {
    chooseDirectory,
    async exportTranscript(request: TranscriptExportRequest, signal): Promise<TranscriptExportOutcome> {
      const meeting = options.meeting.getMeetingRecord(request.meetingId);
      const speakerNames = validatedSpeakerNames(options.meeting, request);
      let directory: string;
      if (request.directory !== undefined) {
        directory = request.directory;
      } else if (request.destination === "choose") {
        const chosen = await chooseDirectory(signal);
        if (chosen === null) throw new TranscriptProjectionError("CANCELLED_BY_USER", "Transcript export was cancelled");
        directory = chosen;
      } else {
        directory = options.directory();
      }
      const folder = await requireDirectory(directory);
      const outputPath = join(folder, transcriptExportFileName({
        createdAtMs: meeting.createdAtMs,
        meetingId: meeting.meetingId,
        recordingStartedAtMs: meeting.recordingStartedAtMs,
        title: meeting.title,
      }, request.format));
      const receipt = await options.meeting.exportTranscript({
        format: request.format,
        includeSpeakers: request.includeSpeakers,
        includeTimestamps: request.includeTimestamps,
        meetingId: request.meetingId,
        outputPath,
        overwrite: true,
        ...(speakerNames === undefined ? {} : { speakerNames }),
        ...(signal === undefined ? {} : { signal }),
      });
      return {
        bytes: receipt.bytes,
        format: receipt.format,
        meetingId: receipt.meetingId,
        outputPath: receipt.outputPath,
        segmentCount: receipt.segmentCount,
        transcriptVersion: receipt.transcriptVersion,
      };
    },
  };
}
