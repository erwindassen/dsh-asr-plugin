import type { CommittedTranscriptSnapshot } from "../storage/meeting-repository.js";
import { type SpeakerNameMap } from "../transcripts/speaker-attribution.js";
import type { TranscriptExportFormat } from "./transcript-projection.js";
export interface RenderTranscriptExportOptions {
    readonly exportedAtMs: number;
    readonly format: TranscriptExportFormat;
    readonly includeSpeakers: boolean;
    readonly includeTimestamps: boolean;
    /** Optional label-to-name map for the speaker label surface only. */
    readonly speakerNames?: SpeakerNameMap;
}
export declare function renderTranscriptExport(snapshot: CommittedTranscriptSnapshot, options: RenderTranscriptExportOptions): string;
