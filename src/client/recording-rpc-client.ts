import { callRecordingRpc } from "./recording-rpc-transport.js";
import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";

import {
  type AudioDeviceInventoryRpc,
  type AudioDeviceRpcEntry,
  type MeetingReferenceRpcCandidate,
  type MeetingReferenceRpcCandidatesPayload,
  type MeetingReferenceRpcPhase,
  type MeetingReferenceRpcResolvePayload,
  type RecordingRpcControlPayload,
  type RecordingRpcPhase,
  type RecordingRpcSegment,
  type RecordingRpcStateValue,
  type RecordingRpcTrack,
  type RecordingRpcView,
  type OkfIngestRpcPayload,
  type OkfIngestRpcValue,
  type SaveSpeakerNamesRpcPayload,
  type StoredMeetingRpcEntry,
  type StoredMeetingTranscriptRpcPayload,
  type StoredMeetingTranscriptRpcValue,
  type SpeakerNamesRpcPayload,
  type SpeakerNamesRpcValue,
  type TranscriptExportRpcPayload,
  type TranscriptExportRpcValue,
} from "../recording/rpc-contract.js";

function speakerNameMap(value: unknown): Readonly<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const [label, name] of Object.entries(record(value))) {
    if (label === "" || typeof name !== "string" || name === "") throw new Error("INVALID_RESPONSE");
    names[label] = name;
  }
  return names;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** One row of the panel's stored-meeting list. */
function storedMeeting(value: unknown): StoredMeetingRpcEntry {
  const item = record(value);
  exact(item, [
    "meeting_id", "title", "started_at", "duration_ms",
    "transcript_version", "status", "ingested_transcript_version",
  ]);
  if (typeof item.meeting_id !== "string" || !UUID_PATTERN.test(item.meeting_id)) {
    throw new Error("INVALID_RESPONSE");
  }
  if (typeof item.title !== "string") throw new Error("INVALID_RESPONSE");
  if (item.status !== "completed" && item.status !== "partial") throw new Error("INVALID_RESPONSE");
  const ingested = item.ingested_transcript_version;
  return {
    meeting_id: item.meeting_id,
    title: item.title,
    started_at: nullableString(item.started_at),
    duration_ms: item.duration_ms === null ? null : nonnegativeInteger(item.duration_ms),
    transcript_version: nonnegativeInteger(item.transcript_version),
    status: item.status,
    ingested_transcript_version: ingested === null ? null : nonnegativeInteger(ingested),
  };
}

function okfIngestValue(value: unknown): OkfIngestRpcValue {
  const item = record(value);
  exact(item, ["job_id", "state", "transcript_version", "error_code", "message"]);
  const state = item.state;
  if (state !== "idle" && state !== "running" && state !== "succeeded" && state !== "failed") {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    job_id: nullableString(item.job_id),
    state,
    transcript_version: item.transcript_version === null
      ? null : nonnegativeInteger(item.transcript_version),
    error_code: nullableString(item.error_code),
    message: nullableString(item.message),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error("INVALID_RESPONSE");
  }
}

function nullableString(value: unknown): string | null {
  if (value === null || typeof value === "string") return value;
  throw new Error("INVALID_RESPONSE");
}

function nonnegativeInteger(value: unknown): number {
  if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
  throw new Error("INVALID_RESPONSE");
}

function nullableNonnegativeInteger(value: unknown): number | null {
  return value === null ? null : nonnegativeInteger(value);
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || new Date(value).toISOString() !== value) {
    throw new Error("INVALID_RESPONSE");
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null {
  return value === null ? null : timestamp(value);
}

function phase(value: unknown): RecordingRpcPhase {
  const phases: readonly RecordingRpcPhase[] = [
    "starting", "recording", "finalizing", "completed", "empty", "partial", "failed", "cancelled",
  ];
  if (phases.includes(value as RecordingRpcPhase)) return value as RecordingRpcPhase;
  throw new Error("INVALID_RESPONSE");
}

function referencePhase(value: unknown): MeetingReferenceRpcPhase {
  return value === "processing" ? value : phase(value);
}

function resultStatus(value: unknown): RecordingRpcView["resultStatus"] {
  if (value === null || value === "completed" || value === "empty" || value === "partial") return value;
  throw new Error("INVALID_RESPONSE");
}

function track(value: unknown): RecordingRpcTrack {
  const item = record(value);
  exact(item, ["errorCode", "requested", "state"]);
  if (typeof item.requested !== "boolean" ||
    (item.state !== "off" && item.state !== "on" && item.state !== "failed")) {
    throw new Error("INVALID_RESPONSE");
  }
  return { errorCode: nullableString(item.errorCode), requested: item.requested, state: item.state };
}

export function parseRecordingRpcView(value: unknown): RecordingRpcView {
  const item = record(value);
  exact(item, [
    "meetingId", "jobId", "phase", "mic", "system", "draftRevision", "draftStale", "latestAudioAtMs",
    "latestDraftAtMs", "recordingStartedAtMs", "recordingEndedAtMs", "recordingElapsedMs",
    "durationMs", "transcriptVersion", "resultStatus", "finalizationMs", "errorCode",
  ]);
  if (typeof item.meetingId !== "string" || !UUID_PATTERN.test(item.meetingId)
    || typeof item.jobId !== "string" ||
    typeof item.draftStale !== "boolean") {
    throw new Error("INVALID_RESPONSE");
  }
  const recordingStartedAtMs = nullableNonnegativeInteger(item.recordingStartedAtMs);
  const recordingEndedAtMs = nullableNonnegativeInteger(item.recordingEndedAtMs);
  const recordingElapsedMs = nullableNonnegativeInteger(item.recordingElapsedMs);
  if ((recordingStartedAtMs === null && recordingElapsedMs !== null)
    || (recordingEndedAtMs !== null && (recordingStartedAtMs === null
    || recordingEndedAtMs < recordingStartedAtMs
    || recordingElapsedMs !== recordingEndedAtMs - recordingStartedAtMs))) {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    meetingId: item.meetingId,
    jobId: item.jobId,
    phase: phase(item.phase),
    mic: track(item.mic),
    system: track(item.system),
    draftRevision: nonnegativeInteger(item.draftRevision),
    draftStale: item.draftStale,
    latestAudioAtMs: nullableNonnegativeInteger(item.latestAudioAtMs),
    latestDraftAtMs: nullableNonnegativeInteger(item.latestDraftAtMs),
    recordingStartedAtMs,
    recordingEndedAtMs,
    recordingElapsedMs,
    durationMs: nullableNonnegativeInteger(item.durationMs),
    transcriptVersion: nullableNonnegativeInteger(item.transcriptVersion),
    resultStatus: resultStatus(item.resultStatus),
    finalizationMs: nullableNonnegativeInteger(item.finalizationMs),
    errorCode: nullableString(item.errorCode),
  };
}

function segment(value: unknown): RecordingRpcSegment {
  const item = record(value);
  exact(item, ["seq", "startMs", "endMs", "speakerLabel", "text"]);
  if (typeof item.text !== "string") {
    throw new Error("INVALID_RESPONSE");
  }
  const seq = nonnegativeInteger(item.seq);
  const startMs = nonnegativeInteger(item.startMs);
  const endMs = nonnegativeInteger(item.endMs);
  if (endMs < startMs) throw new Error("INVALID_RESPONSE");
  return {
    seq,
    startMs,
    endMs,
    speakerLabel: nullableString(item.speakerLabel),
    text: item.text,
  };
}

function parseState(value: unknown): RecordingRpcStateValue {
  const item = record(value);
  exact(item, ["recording", "preview", "hasRecordingHistory"]);
  if (typeof item.hasRecordingHistory !== "boolean") throw new Error("INVALID_RESPONSE");
  if (!Array.isArray(item.preview)) throw new Error("INVALID_RESPONSE");
  return {
    recording: item.recording === null ? null : parseRecordingRpcView(item.recording),
    hasRecordingHistory: item.hasRecordingHistory,
    preview: item.preview.map(segment),
  };
}

function referenceCandidate(value: unknown): MeetingReferenceRpcCandidate {
  const item = record(value);
  exact(item, [
    "meeting_id", "label", "origin", "phase", "started_at", "created_at",
    "recording_elapsed_ms", "duration_ms",
  ]);
  if (typeof item.meeting_id !== "string" || !UUID_PATTERN.test(item.meeting_id)
    || typeof item.label !== "string" || item.label.length < 1 || item.label.length > 255
    || (item.origin !== "import" && item.origin !== "recording")) {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    meeting_id: item.meeting_id,
    label: item.label,
    origin: item.origin,
    phase: referencePhase(item.phase),
    started_at: nullableTimestamp(item.started_at),
    created_at: timestamp(item.created_at),
    recording_elapsed_ms: nullableNonnegativeInteger(item.recording_elapsed_ms),
    duration_ms: nullableNonnegativeInteger(item.duration_ms),
  };
}

function referenceCandidates(value: unknown): readonly MeetingReferenceRpcCandidate[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("INVALID_RESPONSE");
  return value.map(referenceCandidate);
}

function transcriptExportValue(value: unknown): TranscriptExportRpcValue {
  const item = record(value);
  exact(item, ["bytes", "format", "meeting_id", "output_path", "segment_count", "transcript_version"]);
  if (typeof item.meeting_id !== "string" || !UUID_PATTERN.test(item.meeting_id)
    || typeof item.output_path !== "string" || !item.output_path.startsWith("/")
    || (item.format !== "md" && item.format !== "txt" && item.format !== "srt" && item.format !== "vtt")) {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    bytes: nonnegativeInteger(item.bytes),
    format: item.format,
    meeting_id: item.meeting_id,
    output_path: item.output_path,
    segment_count: nonnegativeInteger(item.segment_count),
    transcript_version: nonnegativeInteger(item.transcript_version),
  };
}

function audioDevice(value: unknown): AudioDeviceRpcEntry {
  const item = record(value);
  exact(item, ["uid", "name", "input_channels", "output_channels", "default_input", "default_output"]);
  if (typeof item.uid !== "string" || item.uid.length === 0
    || typeof item.name !== "string" || item.name.length === 0
    || typeof item.default_input !== "boolean" || typeof item.default_output !== "boolean") {
    throw new Error("INVALID_RESPONSE");
  }
  return {
    uid: item.uid,
    name: item.name,
    input_channels: nonnegativeInteger(item.input_channels),
    output_channels: nonnegativeInteger(item.output_channels),
    default_input: item.default_input,
    default_output: item.default_output,
  };
}

function audioDeviceInventory(value: unknown): AudioDeviceInventoryRpc {
  const item = record(value);
  exact(item, ["default_input_uid", "default_output_uid", "devices"]);
  if (!Array.isArray(item.devices)) throw new Error("INVALID_RESPONSE");
  return {
    default_input_uid: nullableString(item.default_input_uid),
    default_output_uid: nullableString(item.default_output_uid),
    devices: item.devices.map(audioDevice),
  };
}

async function call(
  rpc: ClientConnectionRpc,
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const result = await callRecordingRpc(rpc, endpoint, payload, signal);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export class RecordingRpcClient {
  constructor(private readonly rpc: ClientConnectionRpc) {}

  async prepareModels(signal?: AbortSignal): Promise<void> {
    if (await call(this.rpc, "models/prepare", {}, signal) !== null) throw new Error("INVALID_RESPONSE");
  }

  async state(signal?: AbortSignal): Promise<RecordingRpcStateValue> {
    return parseState(await call(this.rpc, "state", {}, signal));
  }

  async referenceCandidates(
    payload: MeetingReferenceRpcCandidatesPayload,
    signal?: AbortSignal,
  ): Promise<readonly MeetingReferenceRpcCandidate[]> {
    return referenceCandidates(await call(
      this.rpc,
      "references/candidates",
      payload,
      signal,
    ));
  }

  async resolveMeetingReference(
    payload: MeetingReferenceRpcResolvePayload,
    signal?: AbortSignal,
  ): Promise<MeetingReferenceRpcCandidate> {
    return referenceCandidate(await call(this.rpc, "references/resolve", payload, signal));
  }

  async control(
    payload: RecordingRpcControlPayload,
    signal?: AbortSignal,
  ): Promise<RecordingRpcView> {
    return parseRecordingRpcView(await call(this.rpc, "control", payload, signal));
  }

  async exportTranscript(
    payload: TranscriptExportRpcPayload,
    signal?: AbortSignal,
  ): Promise<TranscriptExportRpcValue> {
    return transcriptExportValue(await call(this.rpc, "transcripts/export", payload, signal));
  }


  /** Speaker label to display name for one meeting; unnamed labels are absent. */
  async speakerNames(
    payload: SpeakerNamesRpcPayload,
    signal?: AbortSignal,
  ): Promise<SpeakerNamesRpcValue> {
    const value = record(await call(this.rpc, "transcripts/speaker-names", payload, signal));
    exact(value, ["speaker_names"]);
    return { speaker_names: speakerNameMap(value.speaker_names) };
  }

  /** Replaces the stored attribution for one meeting; an empty map clears it. */
  async saveSpeakerNames(
    payload: SaveSpeakerNamesRpcPayload,
    signal?: AbortSignal,
  ): Promise<SpeakerNamesRpcValue> {
    const value = record(await call(this.rpc, "transcripts/save-speaker-names", payload, signal));
    exact(value, ["speaker_names"]);
    return { speaker_names: speakerNameMap(value.speaker_names) };
  }


  /** Stored meetings the panel can load into its draft view, newest first. */
  async listMeetings(limit?: number, signal?: AbortSignal): Promise<readonly StoredMeetingRpcEntry[]> {
    const value = record(await call(
      this.rpc,
      "meetings/list",
      limit === undefined ? {} : { limit },
      signal,
    ));
    exact(value, ["items"]);
    if (!Array.isArray(value.items)) throw new Error("INVALID_RESPONSE");
    return value.items.map(storedMeeting);
  }

  /** Committed transcript of one stored meeting, for the draft view. */
  async meetingTranscript(
    payload: StoredMeetingTranscriptRpcPayload,
    signal?: AbortSignal,
  ): Promise<StoredMeetingTranscriptRpcValue> {
    const value = record(await call(this.rpc, "meetings/transcript", payload, signal));
    exact(value, ["meeting_id", "title", "transcript_version", "duration_ms", "segments"]);
    if (typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id)) {
      throw new Error("INVALID_RESPONSE");
    }
    if (typeof value.title !== "string") throw new Error("INVALID_RESPONSE");
    if (!Array.isArray(value.segments)) throw new Error("INVALID_RESPONSE");
    return {
      meeting_id: value.meeting_id,
      title: value.title,
      transcript_version: nonnegativeInteger(value.transcript_version),
      duration_ms: value.duration_ms === null ? null : nonnegativeInteger(value.duration_ms),
      segments: value.segments.map(segment),
    };
  }

  /** Starts one ingestion run for a stored meeting. */
  async ingestMeeting(payload: OkfIngestRpcPayload, signal?: AbortSignal): Promise<OkfIngestRpcValue> {
    return okfIngestValue(await call(this.rpc, "okf/ingest", payload, signal));
  }

  /** Reads the current or last ingestion attempt for one stored meeting. */
  async ingestionStatus(
    payload: StoredMeetingTranscriptRpcPayload,
    signal?: AbortSignal,
  ): Promise<OkfIngestRpcValue> {
    return okfIngestValue(await call(this.rpc, "okf/ingest/status", payload, signal));
  }

  /** Lists CoreAudio devices through the signed helper. */
  async listDevices(signal?: AbortSignal): Promise<AudioDeviceInventoryRpc> {
    return audioDeviceInventory(await call(this.rpc, "devices/list", {}, signal));
  }

  /** Resolves the folder the user picked, or null when the dialog was cancelled. */
  async chooseTranscriptDirectory(signal?: AbortSignal): Promise<string | null> {
    const value = await call(this.rpc, "transcripts/choose-directory", {}, signal);
    if (value === null) return null;
    if (typeof value !== "string" || !value.startsWith("/")) throw new Error("INVALID_RESPONSE");
    return value;
  }

  /** Resolves the Open knowledge base folder the user picked, or null when cancelled. */
  async chooseOkfDirectory(signal?: AbortSignal): Promise<string | null> {
    const value = await call(this.rpc, "okf/choose-directory", {}, signal);
    if (value === null) return null;
    if (typeof value !== "string" || !value.startsWith("/")) throw new Error("INVALID_RESPONSE");
    return value;
  }
}
