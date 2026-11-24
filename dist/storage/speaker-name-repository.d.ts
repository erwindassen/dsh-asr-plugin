import type { DatabaseSync } from "node:sqlite";
/** One user-assigned display name for one speaker label of one meeting. */
export interface MeetingSpeakerName {
    readonly meetingId: string;
    readonly label: string;
    readonly name: string;
}
/**
 * Persistence for per-meeting speaker names.
 *
 * The repository borrows the caller's database connection and never closes it.
 * Names are a presentation overlay: a committed transcript keeps its labels, and
 * rows cascade with the meeting. `replace` is the only write, so a saved form is
 * one atomic snapshot and an empty array clears the meeting's names.
 */
export interface SpeakerNameRepository {
    /**
     * Names of one meeting ordered by label. A missing meeting is reported as
     * `MEETING_NOT_FOUND` rather than as an empty list.
     */
    list(meetingId: string): readonly MeetingSpeakerName[];
    /** Replaces every name of one meeting in a single transaction. */
    replace(meetingId: string, names: readonly MeetingSpeakerName[]): void;
}
export declare function createSpeakerNameRepository(database: DatabaseSync): SpeakerNameRepository;
