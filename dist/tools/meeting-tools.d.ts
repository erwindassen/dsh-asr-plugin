import type { Context } from "@deepseek-ai/cordis";
import { type ToolDefinition } from "@deepseek-ai/dsh-tools";
import { type DeleteMeetingInput, type DeleteMeetingResult, type ImportMeetingInput, type ImportMeetingStarted, type RetranscribeMeetingInput, type RetranscribeMeetingStarted } from "../application/meeting-application.js";
import type { MeetingLivePage, MeetingLivePageInput, RecordingControlInput } from "../application/recording-application.js";
import { type RecordingSessionView } from "../recording/recording-session.js";
import { type GetMeetingPageInput, type MeetingPage, type MeetingRecord, type SearchMeetingsInput, type SearchMeetingsPage } from "../storage/meeting-repository.js";
import { type AgentTranscriptProjection, type ExportCommittedTranscriptInput, type GetAgentTranscriptProjectionInput, type TranscriptExportReceipt } from "../transcript-projection/transcript-projection.js";
export declare const MEETING_TOOL_NAMES: readonly ["meeting_import_transcribe", "meeting_get", "meeting_search", "meeting_retranscribe", "meeting_delete", "meeting_recording_control", "meeting_live_get", "meeting_transcript_export"];
export interface MeetingToolApplication {
    activeJobIdFor(meeting: MeetingRecord): string | null;
    controlRecording(input: RecordingControlInput): Promise<RecordingSessionView>;
    deleteMeeting(input: DeleteMeetingInput): Promise<DeleteMeetingResult>;
    exportTranscript(input: ExportCommittedTranscriptInput): Promise<TranscriptExportReceipt>;
    getMeetingLivePage(input: MeetingLivePageInput): MeetingLivePage;
    getMeetingAgentProjection(input: GetAgentTranscriptProjectionInput): AgentTranscriptProjection;
    getRecordingState(): RecordingSessionView | null;
    getRecordingPreview(): readonly import("../application/recording-application.js").MeetingLiveSegment[];
    getMeetingPage(input: GetMeetingPageInput): MeetingPage;
    searchMeetings(input: SearchMeetingsInput): SearchMeetingsPage;
    startImport(input: ImportMeetingInput): Promise<ImportMeetingStarted>;
    startRetranscription(input: RetranscribeMeetingInput): Promise<RetranscribeMeetingStarted>;
}
/** Latest Open knowledge base attempt, surfaced by `meeting_get` when configured. */
export interface OkfIngestionSummary {
    readonly state: "running" | "succeeded" | "failed";
    readonly transcriptVersion: number;
    readonly attempt: number;
    readonly finishedAt: string | null;
    readonly errorCode: string | null;
}
export interface MeetingToolOptions {
    readonly okfIngestionFor?: (meetingId: string) => OkfIngestionSummary | null;
}
export declare function createMeetingTools(application: MeetingToolApplication, options?: MeetingToolOptions): readonly ToolDefinition[];
export declare function registerMeetingTools(context: Context, application: MeetingToolApplication, options?: MeetingToolOptions): void;
