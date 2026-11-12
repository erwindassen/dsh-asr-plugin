import type { WorkerLaunchSpec, WorkerProcessOutcome, WorkerSpawner } from "../worker/process.js";
import type { StderrTail } from "../worker/stderr-tail.js";
import type { DraftTranscriptSnapshot, RecordingFinalizeMessage, RecordingFinalResultMessage, RecordingWarningMessage, RecordingWorkerErrorCode, RecordingWorkerReadyMessage } from "./worker-types.js";
export type RecordingWorkerClientErrorCode = RecordingWorkerErrorCode | "WORKER_CANCELLED" | "WORKER_PROCESS_ERROR" | "WORKER_PROTOCOL_ERROR" | "WORKER_TIMEOUT";
export type RecordingWorkerDeadlinePhase = "ready" | "recording" | "finalize" | "termination";
interface RecordingWorkerClientErrorDetails {
    readonly cause?: unknown;
    readonly outcome?: WorkerProcessOutcome;
    readonly phase?: RecordingWorkerDeadlinePhase;
    readonly stage?: string;
    readonly stderr: StderrTail;
}
export declare class RecordingWorkerClientError extends Error {
    readonly code: RecordingWorkerClientErrorCode;
    readonly outcome: WorkerProcessOutcome | undefined;
    readonly phase: RecordingWorkerDeadlinePhase | undefined;
    readonly stage: string | undefined;
    readonly stderrTail: string;
    readonly stderrTruncated: boolean;
    constructor(code: RecordingWorkerClientErrorCode, message: string, details: RecordingWorkerClientErrorDetails);
    static cancelled(phase: RecordingWorkerDeadlinePhase): RecordingWorkerClientError;
}
export interface RecordingWorkerClientOptions {
    readonly expectedFingerprint: string;
    readonly spawner: WorkerSpawner;
    readonly launch: WorkerLaunchSpec;
    readonly readyTimeoutMs: number;
    readonly finalizeDeadlineMs: number;
    readonly terminationTimeoutMs: number;
}
export interface RecordingWorkerStartOptions {
    readonly signal?: AbortSignal;
    readonly onReady?: (message: RecordingWorkerReadyMessage) => void;
    readonly onRevision?: (snapshot: DraftTranscriptSnapshot) => void;
    readonly onWarning?: (message: RecordingWarningMessage) => void;
}
export interface RecordingWorkerSession {
    readonly completion: Promise<RecordingFinalResultMessage>;
    snapshot(): DraftTranscriptSnapshot;
    finalize(message: RecordingFinalizeMessage): Promise<RecordingFinalResultMessage>;
    terminate(): Promise<void>;
}
export declare class RecordingWorkerClient {
    private readonly options;
    constructor(options: RecordingWorkerClientOptions);
    start(startOptions?: RecordingWorkerStartOptions): Promise<RecordingWorkerSession>;
}
export {};
