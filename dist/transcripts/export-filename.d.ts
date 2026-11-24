import type { TranscriptExportFormat } from "../transcript-projection/transcript-projection.js";
export interface TranscriptFileNameInput {
    readonly createdAtMs: number;
    readonly meetingId: string;
    readonly recordingStartedAtMs: number | null;
    readonly title: string;
}
/**
 * Compact UTC stamp used both in the fallback name and inside default titles.
 * Colons are not valid in file names on some file systems, so they collapse.
 */
export declare function transcriptExportStamp(epochMs: number): string;
/**
 * Deterministic export name: a readable title slug plus the recording stamp.
 * Names stay ASCII so they survive every file system the picker can reach.
 */
export declare function transcriptExportFileName(meeting: TranscriptFileNameInput, format: TranscriptExportFormat): string;
