import type { DatabaseSync } from "node:sqlite";
import type { ListMeetingReferenceRecordsInput, MeetingRecord } from "./types.js";
export declare function listMeetingReferenceRecords(database: DatabaseSync, input: ListMeetingReferenceRecordsInput): readonly MeetingRecord[];
