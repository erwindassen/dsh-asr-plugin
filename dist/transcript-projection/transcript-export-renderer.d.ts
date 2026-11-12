import type { CommittedTranscriptSnapshot } from "../storage/meeting-repository.js";
import type { TranscriptExportFormat } from "./transcript-projection.js";
export interface RenderTranscriptExportOptions {
    readonly exportedAtMs: number;
    readonly format: TranscriptExportFormat;
    readonly includeSpeakers: boolean;
    readonly includeTimestamps: boolean;
}
export declare function renderTranscriptExport(snapshot: CommittedTranscriptSnapshot, options: RenderTranscriptExportOptions): string;
