import type { TranscriptExportFormat } from "../transcript-projection/transcript-projection.js";
import type { SpeakerNameMap } from "./speaker-attribution.js";
export declare const TRANSCRIPT_EXPORT_FORMATS: readonly ["md", "txt", "srt", "vtt"];
export type TranscriptExportDestination = "default" | "choose";
export interface TranscriptExportRequest {
    /** Explicit absolute folder; wins over the destination mode when present. */
    readonly directory?: string;
    readonly destination: TranscriptExportDestination;
    readonly format: TranscriptExportFormat;
    readonly includeSpeakers: boolean;
    readonly includeTimestamps: boolean;
    readonly meetingId: string;
    /** Optional speaker-label to display-name map; empty means keep the labels. */
    readonly speakerNames?: SpeakerNameMap;
}
export interface TranscriptExportOutcome {
    readonly bytes: number;
    readonly format: TranscriptExportFormat;
    readonly meetingId: string;
    readonly outputPath: string;
    readonly segmentCount: number;
    readonly transcriptVersion: number;
}
/**
 * Host-side transcript export: resolves the destination folder, names the file
 * from meeting metadata and delegates the write to the committed-transcript
 * exporter so managed-data and extension rules stay in one place.
 */
export interface TranscriptExportControl {
    chooseDirectory(signal?: AbortSignal): Promise<string | null>;
    exportTranscript(request: TranscriptExportRequest, signal?: AbortSignal): Promise<TranscriptExportOutcome>;
}
