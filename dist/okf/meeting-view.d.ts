import type { MeetingRepository } from "../storage/meeting-repository.js";
import { type OkfMeetingView } from "./contracts.js";
type MeetingSource = Pick<MeetingRepository, "getMeeting" | "getCommittedTranscriptSnapshot">;
/**
 * Reads one committed transcript version and freezes it into the bundle view.
 * The view is a plain value so ingestion never re-reads a moving transcript.
 */
export declare function buildOkfMeetingView(source: MeetingSource, meetingId: string, speakerNames?: Readonly<Record<string, string>>): OkfMeetingView;
export {};
