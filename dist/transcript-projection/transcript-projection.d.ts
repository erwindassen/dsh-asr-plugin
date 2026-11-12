import { type AnchoredTranscriptSegment, type CommittedStatus, type MeetingRecord, type MeetingRepository } from "../storage/meeting-repository.js";
export interface AgentTranscriptCoverage {
    readonly returnedFromSeq: number | null;
    readonly returnedThroughSeq: number | null;
    readonly returnedFromMs: number | null;
    readonly returnedThroughMs: number | null;
    readonly returnedSegments: number;
    readonly totalSegments: number;
    readonly remainingSegments: number;
    readonly complete: boolean;
    readonly renderedBytes: number;
}
export interface AgentTranscriptProjection {
    readonly activeJobId: string | null;
    readonly meeting: MeetingRecord;
    readonly transcript: {
        readonly projection: "agent";
        readonly available: boolean;
        readonly version: number | null;
        readonly resultStatus: CommittedStatus | null;
        readonly segments: readonly AnchoredTranscriptSegment[];
        readonly nextCursor: string | null;
        readonly coverage: AgentTranscriptCoverage | null;
    };
}
export interface GetAgentTranscriptProjectionInput {
    readonly meetingId: string;
    readonly cursor?: string;
}
export type TranscriptExportFormat = "md" | "txt" | "srt" | "vtt";
export interface ExportCommittedTranscriptInput {
    readonly format: TranscriptExportFormat;
    readonly includeSpeakers?: boolean;
    readonly includeTimestamps?: boolean;
    readonly meetingId: string;
    readonly outputPath: string;
    readonly overwrite?: boolean;
    readonly signal?: AbortSignal;
}
export interface TranscriptExportReceipt {
    readonly bytes: number;
    readonly durationMs: number;
    readonly format: TranscriptExportFormat;
    readonly meetingId: string;
    readonly outputPath: string;
    readonly overwritten: boolean;
    readonly segmentCount: number;
    readonly sha256: string;
    readonly transcriptVersion: number;
}
export interface TranscriptProjectionOptions {
    readonly dataRoot: string;
    readonly now: () => number;
}
export interface TranscriptProjection {
    exportCommittedTranscript(input: ExportCommittedTranscriptInput): Promise<TranscriptExportReceipt>;
    getCommittedAgentProjection(input: GetAgentTranscriptProjectionInput): AgentTranscriptProjection;
}
export declare function agentTranscriptProjectionValue(value: AgentTranscriptProjection): {
    meeting: {
        meeting_id: string;
        origin: import("../storage/types.js").MeetingOrigin;
        title: string;
        source_name: string;
        source_format: import("../audio/source-format.js").AudioSourceFormat;
        source_sha256: string | null;
        created_at: string;
        updated_at: string;
        recording_started_at: string | null;
        recording_ended_at: string | null;
        duration_ms: number | null;
        status: import("../storage/types.js").MeetingStatus;
        committed_status: CommittedStatus | null;
        transcript_version: number;
        result_reason: string | null;
        engine_fingerprint: string | null;
        active_job_id: string | null;
        error_code: string | null;
    };
    transcript: {
        projection: "agent";
        available: boolean;
        version: number | null;
        result_status: CommittedStatus | null;
        segments: {
            anchor: string;
            seq: number;
            start_ms: number;
            end_ms: number;
            speaker_label: string;
            text: string;
        }[];
        next_cursor: string | null;
        coverage: {
            returned_from_seq: number | null;
            returned_through_seq: number | null;
            returned_from_ms: number | null;
            returned_through_ms: number | null;
            returned_segments: number;
            total_segments: number;
            remaining_segments: number;
            complete: boolean;
            rendered_bytes: number;
        } | null;
    };
};
export type AgentTranscriptProjectionValue = ReturnType<typeof agentTranscriptProjectionValue>;
export declare function renderAgentTranscriptProjectionText(value: AgentTranscriptProjectionValue): string;
export { TranscriptProjectionError } from "./transcript-export-error.js";
export type { TranscriptProjectionErrorCode } from "./transcript-export-error.js";
export declare function createTranscriptProjection(repository: MeetingRepository, activeJobIdFor: (meeting: MeetingRecord) => string | null, options: TranscriptProjectionOptions): TranscriptProjection;
