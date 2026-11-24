import type { OkfIngestionRecord } from "../okf/contracts.js";
import type { MeetingRecord, TranscriptSegment } from "./types.js";
export declare function parseMeetingRow(value: unknown): MeetingRecord;
export declare function parseSegmentRow(value: unknown): TranscriptSegment;
export declare function okfIngestionRecordFromRow(value: unknown): OkfIngestionRecord;
