import type { JobOutputSource } from "@deepseek-ai/dsh-jobs";
import type { ProcessingIdentity } from "../assets/processing-identity.js";
import type { JobHooks } from "@deepseek-ai/dsh-jobs";
import type { RecordingAudioLayout, ManagedAudioStore } from "../storage/managed-audio-store.js";
import type { MeetingRepository } from "../storage/meeting-repository.js";
import type { DraftTranscriptSnapshot, RecordingWarningMessage } from "./worker-types.js";
import type { RecordingWorkerSession } from "./worker-client.js";
export type RecordingHelperTrackState = "off" | "starting" | "on" | "failed";
export type RecordingTrack = "mic" | "system";
export type RecordingSessionPhase = "starting" | "recording" | "finalizing" | "completed" | "empty" | "partial" | "failed" | "cancelled";
export interface RecordingHelperTrackSnapshot {
    readonly errorCode: string | null;
    readonly requested: boolean;
    readonly state: RecordingHelperTrackState;
}
export interface RecordingHelperSnapshot {
    readonly captureEndUs: number;
    readonly mic: RecordingHelperTrackSnapshot;
    readonly system: RecordingHelperTrackSnapshot;
}
export interface RecordingHelperSession {
    readonly completion: Promise<void>;
    snapshot(): RecordingHelperSnapshot;
    setTrack(track: RecordingTrack, requested: boolean): Promise<RecordingHelperSnapshot>;
    stop(): Promise<RecordingHelperSnapshot>;
    terminate(): Promise<void>;
}
export interface RecordingSessionHelperFactory {
    start(input: {
        readonly layout: RecordingAudioLayout;
        readonly meetingId: string;
        readonly signal: AbortSignal;
    }): Promise<RecordingHelperSession>;
}
export interface RecordingSessionWorkerFactory {
    start(input: {
        readonly layout: RecordingAudioLayout;
        readonly meetingId: string;
        readonly onWarning: (warning: RecordingWarningMessage) => void;
        readonly runId: string;
        readonly signal: AbortSignal;
    }): Promise<RecordingWorkerSession>;
}
export interface RecordingSessionIdentity {
    readonly baseVersion: number;
    readonly meetingId: string;
    readonly requestMonotonicMs: number;
    readonly requestWallClockMs: number;
    readonly requestId: string;
    readonly runId: string;
    readonly title: string;
}
export interface RecordingSessionDependencies {
    readonly processingIdentity?: ProcessingIdentity;
    readonly audioStore: ManagedAudioStore;
    readonly engineFingerprint: string;
    readonly helper: RecordingSessionHelperFactory;
    readonly monotonicNow?: () => number;
    readonly now: () => number;
    readonly repository: MeetingRepository;
    readonly worker: RecordingSessionWorkerFactory;
}
export interface RecordingTrackView {
    readonly errorCode: string | null;
    readonly requested: boolean;
    readonly state: "off" | "on" | "failed";
}
export interface RecordingSessionView {
    readonly draftRevision: number;
    readonly draftStale: boolean;
    readonly errorCode: string | null;
    readonly finalizationMs: number | null;
    readonly jobId: string;
    readonly latestAudioAtMs: number | null;
    readonly latestDraftAtMs: number | null;
    readonly meetingId: string;
    readonly mic: RecordingTrackView;
    readonly phase: RecordingSessionPhase;
    readonly recordingEndedAtMs: number | null;
    readonly recordingElapsedMs: number | null;
    readonly recordingStartedAtMs: number | null;
    readonly durationMs: number | null;
    readonly resultStatus: "completed" | "empty" | "partial" | null;
    readonly system: RecordingTrackView;
    readonly transcriptVersion: number | null;
}
export declare class RecordingSessionError extends Error {
    readonly code: string;
    constructor(code: string, options?: ErrorOptions);
}
export declare class RecordingSession {
    readonly identity: RecordingSessionIdentity;
    private readonly dependencies;
    private readonly release;
    readonly hooks: JobHooks;
    readonly output: JobOutputSource;
    readonly meetingId: string;
    readonly runId: string;
    readonly started: Promise<RecordingSessionView>;
    private readonly abort;
    private readonly startedState;
    private readonly doneState;
    private cancelRequested;
    private commandTail;
    private finalizationMs;
    private helperSession;
    private initialization;
    private jobIdValue;
    private phase;
    private recordingEndedAtMs;
    private recordingStartedAtMs;
    private durationMs;
    private settlement;
    private terminalErrorCode;
    private transcriptVersion;
    private resultStatus;
    private workerFailure;
    private workerLayout;
    private workerRestarted;
    private workerSession;
    constructor(identity: RecordingSessionIdentity, dependencies: RecordingSessionDependencies, release: (session: RecordingSession) => void);
    get jobId(): string | null;
    claim(): void;
    publish(jobId: string): void;
    snapshot(): DraftTranscriptSnapshot;
    view(): RecordingSessionView;
    setTrack(track: RecordingTrack, requested: boolean): Promise<RecordingSessionView>;
    stop(): Promise<RecordingSessionView>;
    private failStop;
    private initialize;
    private cancel;
    private linearizeFailure;
    private adoptTerminal;
    private settle;
    private startHelper;
    private observeHelper;
    private handleHelperFailure;
    private startWorker;
    private launchWorker;
    private installWorker;
    private observeWorker;
    private handleWorkerFailure;
    private finalWorker;
    private enqueue;
    private timestamp;
    private anchoredWallClock;
    private recordingElapsed;
    private adoptRecordingFacts;
    private monotonicNow;
    private contentFreeView;
}
