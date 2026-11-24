import type { DatabaseSync } from "node:sqlite";
import type { OkfIngestionRecord } from "../okf/contracts.js";
import type { BeginOkfIngestionInput, FinishOkfIngestionInput } from "./types.js";
/**
 * Persistence for OKF ingestion attempts.
 *
 * The repository borrows the caller's database connection and never closes it.
 * Attempts are keyed by `(meetingId, transcriptVersion, directory)`, so repeating
 * the same target bumps `attempt` instead of adding a row. Rows cascade with the
 * meeting.
 */
export interface OkfIngestionRepository {
    beginAttempt(input: BeginOkfIngestionInput): OkfIngestionRecord;
    finishAttempt(input: FinishOkfIngestionInput): OkfIngestionRecord;
    findAttempt(meetingId: string, transcriptVersion: number, directory: string): OkfIngestionRecord | undefined;
    findLatestForMeeting(meetingId: string): OkfIngestionRecord | undefined;
    listForMeeting(meetingId: string, limit: number): readonly OkfIngestionRecord[];
    /**
     * Attempts left in `running` state. A single host owns a bundle, so any such
     * row after startup was interrupted and can be closed as failed.
     */
    listRunning(limit: number): readonly OkfIngestionRecord[];
}
export declare function createOkfIngestionRepository(database: DatabaseSync): OkfIngestionRepository;
export type { BeginOkfIngestionInput, FinishOkfIngestionInput } from "./types.js";
