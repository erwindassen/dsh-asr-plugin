import type { MeetingRuntimeSnapshot } from "./meeting-runtime.js";
import type { JobRegistry, JobSpec } from "@deepseek-ai/dsh-jobs";
import { type DraftTranscriptPage } from "../recording/draft-transcript-page.js";
import type { DraftTranscriptSnapshot } from "../recording/worker-types.js";
import { type RecordingSessionHelperFactory, type RecordingSessionWorkerFactory, type RecordingSessionView } from "../recording/recording-session.js";
import type { ManagedAudioStore } from "../storage/managed-audio-store.js";
import { type GetMeetingPageInput, type MeetingPage, type MeetingRecord, type MeetingRepository, type SearchMeetingsInput, type SearchMeetingsPage } from "../storage/meeting-repository.js";
import type { WorkerRunner } from "../worker/worker-pipeline.js";
import { type AgentTranscriptProjection, type ExportCommittedTranscriptInput, type GetAgentTranscriptProjectionInput, type TranscriptExportReceipt } from "../transcript-projection/transcript-projection.js";
import { type GetMeetingReferenceCandidatesInput, type MeetingReferenceCandidate, type ResolveMeetingReferenceInput } from "./meeting-reference.js";
import { type MeetingLivePage, type MeetingLivePageInput, type RecordingControlInput } from "./recording-application.js";
declare module "@deepseek-ai/dsh-jobs" {
    interface JobKindMap {
        meeting: "meeting";
    }
}
export type MeetingApplicationErrorCode = "INVALID_INPUT" | "CANCELLED_BY_USER";
export declare class MeetingApplicationError extends Error {
    readonly code: MeetingApplicationErrorCode;
    constructor(code: MeetingApplicationErrorCode, message: string);
}
export interface MeetingApplicationOptions {
    readonly prepareRuntime?: (signal?: AbortSignal, purpose?: "batch" | "recording") => Promise<MeetingRuntimeSnapshot>;
    readonly asr: WorkerRunner;
    readonly audioStore: ManagedAudioStore;
    readonly dataRoot: string;
    readonly diarization: WorkerRunner;
    readonly engineFingerprint: string;
    readonly generateId?: () => string;
    readonly jobs: Pick<JobRegistry, "start">;
    readonly now?: () => number;
    readonly repository: MeetingRepository;
    readonly recording?: {
        readonly checkPermissions?: (signal?: AbortSignal) => Promise<void>;
        readonly helper: RecordingSessionHelperFactory;
        readonly monotonicNow?: () => number;
        readonly worker: RecordingSessionWorkerFactory;
    };
}
export interface RecordingDraftSource {
    readonly meetingId: string;
    readonly runId: string;
    snapshot(): DraftTranscriptSnapshot;
}
export interface GetRecordingDraftPageInput {
    readonly meetingId: string;
    readonly cursor?: string;
    readonly limit?: number;
}
export interface ImportMeetingInput {
    readonly owner?: JobSpec["owner"];
    readonly path: string;
    readonly signal?: AbortSignal;
    readonly title?: string;
}
export interface ImportMeetingStarted {
    readonly meetingId: string;
    readonly jobId: string;
    readonly status: "processing";
}
export interface RetranscribeMeetingInput {
    readonly expectedVersion: number;
    readonly meetingId: string;
    readonly owner?: JobSpec["owner"];
    readonly signal?: AbortSignal;
}
export interface RetranscribeMeetingStarted extends ImportMeetingStarted {
    readonly baseVersion: number;
    readonly targetVersion: number;
}
export interface DeleteMeetingInput {
    readonly expectedVersion: number;
    readonly meetingId: string;
}
export interface DeleteMeetingResult {
    readonly deleted: true;
    readonly freedBytes: number;
    readonly meetingId: string;
}
export interface StartupReconciliationResult {
    readonly completedDeletions: number;
    readonly failedDeletionIds: readonly string[];
    readonly failedRecordingRecoveryIds: readonly string[];
    readonly orphanedRuns: number;
    readonly recoveredRecordingIds: readonly string[];
}
export declare class MeetingApplication {
    private readonly dependencies;
    private readonly prepareRuntime;
    private readonly generateId;
    private readonly jobs;
    private readonly transcriptProjection;
    private accepting;
    private active;
    private readonly recording;
    private recordingDraft;
    private shutdownTask;
    constructor(options: MeetingApplicationOptions);
    controlRecording(input: RecordingControlInput): Promise<RecordingSessionView>;
    getMeetingLivePage(input: MeetingLivePageInput): MeetingLivePage;
    getRecordingState(): RecordingSessionView | null;
    getRecordingPreview(): readonly import("./recording-application.js").MeetingLiveSegment[];
    hasRecordingHistory(): boolean;
    prepareRecording(signal?: AbortSignal): Promise<void>;
    startImport(input: ImportMeetingInput): Promise<ImportMeetingStarted>;
    startRetranscription(input: RetranscribeMeetingInput): Promise<RetranscribeMeetingStarted>;
    deleteMeeting(input: DeleteMeetingInput): Promise<DeleteMeetingResult>;
    reconcileStartup(): Promise<StartupReconciliationResult>;
    getMeetingPage(input: GetMeetingPageInput): MeetingPage;
    getMeetingAgentProjection(input: GetAgentTranscriptProjectionInput): AgentTranscriptProjection;
    exportTranscript(input: ExportCommittedTranscriptInput): Promise<TranscriptExportReceipt>;
    getMeetingReferenceCandidates(input: GetMeetingReferenceCandidatesInput): readonly MeetingReferenceCandidate[];
    resolveMeetingReference(input: ResolveMeetingReferenceInput): MeetingReferenceCandidate;
    attachRecordingDraft(source: RecordingDraftSource): () => void;
    getRecordingDraftPage(input: GetRecordingDraftPageInput): DraftTranscriptPage;
    searchMeetings(input: SearchMeetingsInput): SearchMeetingsPage;
    shutdown(): Promise<void>;
    activeJobIdFor(meeting: MeetingRecord): string | null;
    private claim;
    private now;
    private release;
    private activeFor;
    private assertAccepting;
    private assertIdle;
    private requiredRecording;
    private assertRetranscriptionTarget;
    private assertManagedSource;
    private ensureRecordingSource;
    private createRun;
    private publish;
    private requiredMeeting;
    private completeFencedDeletion;
    private recoverRecordingSources;
    private performShutdown;
}
