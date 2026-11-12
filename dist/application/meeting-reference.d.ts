import type { RecordingSessionView } from "../recording/recording-session.js";
import type { MeetingRecord } from "../storage/meeting-repository.js";
export type MeetingReferencePhase = "starting" | "recording" | "finalizing" | "processing" | "completed" | "empty" | "partial" | "failed" | "cancelled";
export interface MeetingReferenceCandidate {
    readonly meetingId: string;
    readonly label: string;
    readonly origin: MeetingRecord["origin"];
    readonly phase: MeetingReferencePhase;
    readonly startedAtMs: number | null;
    readonly createdAtMs: number;
    readonly recordingElapsedMs: number | null;
    readonly durationMs: number | null;
}
export interface GetMeetingReferenceCandidatesInput {
    readonly locale: string;
    readonly query?: string;
}
export interface ResolveMeetingReferenceInput {
    readonly locale: string;
    readonly meetingId: string;
}
export declare function validateMeetingReferenceLocale(locale: string): void;
export declare function isActiveReferencePhase(phase: MeetingReferencePhase): boolean;
export declare function meetingReferenceCandidate(meeting: MeetingRecord, online: RecordingSessionView | null): MeetingReferenceCandidate;
