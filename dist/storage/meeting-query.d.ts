import type { DatabaseSync } from "node:sqlite";
import type { CommittedTranscriptSlice, CommittedTranscriptSnapshot, GetCommittedTranscriptSliceInput, GetMeetingPageInput, MeetingPage, SearchMeetingsInput, SearchMeetingsPage } from "./types.js";
export declare function getMeetingPage(database: DatabaseSync, input: GetMeetingPageInput): MeetingPage;
export declare function getCommittedTranscriptSlice(database: DatabaseSync, input: GetCommittedTranscriptSliceInput): CommittedTranscriptSlice;
export declare function getCommittedTranscriptSnapshot(database: DatabaseSync, meetingId: string): CommittedTranscriptSnapshot;
export declare function searchMeetings(database: DatabaseSync, input: SearchMeetingsInput): SearchMeetingsPage;
