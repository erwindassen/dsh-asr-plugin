import type { OkfIngestRpcValue, StoredMeetingRpcEntry, StoredMeetingTranscriptRpcValue } from "../recording/rpc-contract.js";
import type { MeetingRepository } from "../storage/meeting-repository.js";
import type { OkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
import type { SpeakerNameRepository } from "../storage/speaker-name-repository.js";
export declare const DEFAULT_STORED_MEETINGS_LIMIT = 20;
export declare const MAX_STORED_MEETINGS_LIMIT = 50;
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
export declare function createStoredMeetingPanel(options: StoredMeetingPanelOptions): StoredMeetingPanel;
