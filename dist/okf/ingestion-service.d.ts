import type { JobRegistry } from "@deepseek-ai/dsh-jobs";
import type { MeetingRepository } from "../storage/meeting-repository.js";
import type { OkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
import { type OkfAgentPort, type OkfIngestionRecord } from "./contracts.js";
import type { OkfBundleLock } from "./bundle-lock.js";
import type { OkfGitTransaction } from "./git-transaction.js";
/** What the settings panel resolves for the plugin at call time. */
export interface OkfSettings {
    readonly directory: string;
    readonly ingest: boolean;
}
export interface OkfIngestionRequest {
    readonly meetingId: string;
    /** Re-ingest even when automatic ingestion is switched off. */
    readonly force?: boolean;
    /**
     * Set by the automatic trigger: a version that already ingested successfully
     * is not processed twice. A manual `/asr-ingest` deliberately omits it, so the
     * user can always re-run.
     */
    readonly skipIfSucceeded?: boolean;
    readonly signal?: AbortSignal;
}
export type OkfIngestionOutcomeKind = "ingested" | "skill-missing" | "started" | "disabled" | "failed";
export interface OkfIngestionOutcome {
    readonly kind: OkfIngestionOutcomeKind;
    readonly meetingId: string;
    readonly jobId: string | null;
    readonly message: string;
}
export interface OkfIngestionDeps {
    readonly repository: Pick<MeetingRepository, "getMeeting" | "getCommittedTranscriptSnapshot">;
    /** Per-meeting speaker attribution, applied to the transcript copy only. */
    readonly speakerNames?: {
        list(meetingId: string): readonly {
            readonly label: string;
            readonly name: string;
        }[];
    };
    /** Persists attempts in `okf_ingestion`. */
    readonly attempts: Pick<OkfIngestionRepository, "beginAttempt" | "finishAttempt" | "findAttempt" | "findLatestForMeeting" | "listRunning">;
    readonly git: OkfGitTransaction;
    readonly lock: OkfBundleLock;
    readonly agent: OkfAgentPort;
    readonly settings: () => OkfSettings;
    /** Job registry handed in by the host. */
    readonly jobs: Pick<JobRegistry, "start">;
    readonly nowMs?: () => number;
    readonly logger?: (line: string) => void;
}
export interface OkfIngestionService {
    /** Fire-and-forget path used by the automatic trigger. */
    start(request: OkfIngestionRequest): OkfIngestionOutcome;
    /** Awaited path used by `/asr-ingest`. */
    run(request: OkfIngestionRequest): Promise<OkfIngestionOutcome>;
    /** Rolls back an ingestion that died mid-flight, if the journal survived a crash. */
    recoverStartup(): Promise<void>;
    state(meetingId: string): OkfIngestionRecord | undefined;
    /** Resolves once no ingestion is in flight; used before the host closes its database. */
    whenIdle(): Promise<void>;
    /** Cancels in-flight ingestions and refuses new ones. */
    shutdown(): Promise<void>;
}
declare module "@deepseek-ai/dsh-jobs" {
    interface JobKindMap {
        "asr-okf-ingest": "asr-okf-ingest";
    }
}
export declare function createOkfIngestionService(deps: OkfIngestionDeps): OkfIngestionService;
