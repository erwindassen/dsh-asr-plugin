import type { MeetingRepository } from "../storage/meeting-repository.js";
import type { OkfIngestionService } from "./ingestion-service.js";
export interface TranscriptCommitHook {
    /** Called once a transcript version is committed and readable. */
    readonly onCommitted: (meetingId: string, transcriptVersion: number) => void;
}
/**
 * Both import and retranscription funnel through `commitTranscript`, so one
 * interception covers every committed version while drafts, cancelled
 * recordings and failed runs never reach the hook at all.
 */
export declare function withTranscriptCommitHook(repository: MeetingRepository, hook: TranscriptCommitHook): MeetingRepository;
export interface StartOkfIngestionOptions {
    readonly settings: () => {
        readonly directory: string;
        readonly ingest: boolean;
    };
    /**
     * Committed status of the version that just landed. An empty transcript has
     * nothing to summarise, so it must not start a job that can only fail.
     */
    readonly committedStatus?: "completed" | "empty" | "partial";
}
/** Starts ingestion for a committed version when the settings allow it. */
export declare function startOkfIngestion(service: OkfIngestionService, options: StartOkfIngestionOptions, meetingId: string): void;
