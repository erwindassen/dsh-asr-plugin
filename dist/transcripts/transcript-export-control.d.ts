import type { MeetingRecord } from "../storage/types.js";
import type { ExportCommittedTranscriptInput, TranscriptExportReceipt } from "../transcript-projection/transcript-projection.js";
import { type DirectoryPicker } from "./directory-picker.js";
import type { TranscriptExportControl } from "./transcript-export-contract.js";
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
export declare function createTranscriptExportControl(options: TranscriptExportControlOptions): TranscriptExportControl;
