import type { RefObject } from "react";
import type { StoredMeetingRpcEntry, StoredMeetingTranscriptRpcValue } from "../recording/rpc-contract.js";
import type { RecordingRpcClient } from "./recording-rpc-client.js";
/** Poll cadence while the host works on an ingestion. */
export declare const INGEST_POLL_MS = 2000;
/** Five minutes: long enough for the agent, short enough to stop a stuck spinner. */
export declare const INGEST_POLL_ATTEMPTS = 150;
export type IngestionFailure = "notConfigured" | "busy" | "noModel" | "noTranscript" | "unavailable" | "timeout";
export interface MeetingIngestion {
    readonly running: boolean;
    readonly outcome: "succeeded" | "failed" | null;
    readonly failure: IngestionFailure | null;
    /**
     * The failing step in the host's own words. The category above is all the UI
     * needs to offer advice; this is what makes a novel failure debuggable instead
     * of a shrug ("The meeting could not be added…").
     */
    readonly detail: string | null;
    readonly start: () => void;
}
/** Why a folder-to-database sync stopped; the raw message never reaches the UI. */
export type SyncFailure = "notConfigured" | "missingFolder" | "failed";
export interface StoredMeetingsSync {
    /** Meetings the folder does not hold, waiting for the user to confirm. */
    readonly pending: number | null;
    readonly busy: boolean;
    readonly failure: SyncFailure | null;
    /** Meetings the last applied sync removed. */
    readonly removed: number | null;
    /** Counts what a sync would remove. */
    readonly request: () => void;
    /** Removes those meetings for real. */
    readonly confirm: () => void;
    readonly cancel: () => void;
}
export interface StoredMeetings {
    readonly entries: readonly StoredMeetingRpcEntry[];
    readonly loading: boolean;
    readonly error: string | null;
    readonly selected: StoredMeetingRpcEntry | null;
    readonly transcript: StoredMeetingTranscriptRpcValue | null;
    readonly transcriptLoading: boolean;
    readonly transcriptError: string | null;
    /** A live recording owns the draft area; stored rows stay inactive meanwhile. */
    readonly disabled: boolean;
    readonly select: (entry: StoredMeetingRpcEntry) => void;
    readonly clear: () => void;
    readonly reload: () => void;
    /** Folder-to-database reconciliation behind the "Sync" button. */
    readonly sync: StoredMeetingsSync;
}
/**
 * Only the categories the panel can explain are kept; the raw message may name
 * a folder, a transcript or an internal failure and must never reach the UI.
 * A failed RPC wraps the host code inside its message, so match on containment.
 */
export declare function ingestionFailure(code: string | null): IngestionFailure;
/** Maps a sync refusal to the one sentence the panel can show. */
export declare function syncFailure(code: string | null): SyncFailure;
export interface MeetingIngestionOptions {
    readonly client: RecordingRpcClient;
    readonly meetingId: string | null;
    readonly mounted: RefObject<boolean>;
    readonly onIngested?: ((meetingId: string) => void) | undefined;
}
/**
 * Starts one user-driven ingestion and polls its attempt until it settles.
 * The poll is bounded; a timeout shows the same short retry message as a
 * failure instead of leaving the button spinning forever.
 */
export declare function useMeetingIngestion(options: MeetingIngestionOptions): MeetingIngestion;
export interface StoredMeetingsOptions {
    readonly client: RecordingRpcClient;
    readonly mounted: RefObject<boolean>;
    readonly active: boolean;
}
/**
 * Lists committed meetings and loads one committed transcript on demand. A
 * live recording clears the selection so the draft area always follows it.
 */
export declare function useStoredMeetings(options: StoredMeetingsOptions): StoredMeetings;
