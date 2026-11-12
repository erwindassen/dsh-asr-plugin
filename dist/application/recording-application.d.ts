import type { MeetingRuntimeSnapshot } from "./meeting-runtime.js";
import type { JobHooks, JobRegistry, JobSpec } from "@deepseek-ai/dsh-jobs";
import { RecordingSession, type RecordingSessionHelperFactory, type RecordingSessionView, type RecordingSessionWorkerFactory } from "../recording/recording-session.js";
import type { DraftTranscriptSnapshot } from "../recording/worker-types.js";
import type { ManagedAudioStore } from "../storage/managed-audio-store.js";
import { type MeetingRepository } from "../storage/meeting-repository.js";
export type RecordingControlInput = {
    readonly action: "start";
    readonly owner?: JobSpec["owner"];
    readonly signal?: AbortSignal;
    readonly title?: string;
} | {
    readonly action: "stop" | "mic_on" | "mic_off" | "system_on" | "system_off";
    readonly meetingId: string;
    readonly signal?: AbortSignal;
};
export interface MeetingLivePageInput {
    readonly cursor?: string;
    readonly limit?: number;
    readonly meetingId: string;
}
export interface MeetingLivePage {
    readonly audioThroughMs: number;
    readonly meetingId: string;
    readonly nextCursor: string | null;
    readonly phase: RecordingSessionView["phase"];
    readonly recordingEndedAtMs: number | null;
    readonly recordingElapsedMs: number | null;
    readonly recordingStartedAtMs: number | null;
    readonly provisional: true;
    readonly resultStatus: null;
    readonly revision: number;
    readonly segments: readonly MeetingLiveSegment[];
    readonly stale: boolean;
    readonly transcriptVersion: null;
}
export interface MeetingLiveSegment {
    readonly endMs: number;
    readonly seq: number;
    readonly speakerLabel: string | null;
    readonly startMs: number;
    readonly text: string;
}
export interface RecordingApplicationDependencies {
    readonly checkPermissions?: (signal?: AbortSignal) => Promise<void>;
    readonly prepareRuntime?: (signal?: AbortSignal, purpose?: "batch" | "recording") => Promise<MeetingRuntimeSnapshot>;
    readonly audioStore: ManagedAudioStore;
    readonly engineFingerprint: string;
    readonly generateId: () => string;
    readonly helper: RecordingSessionHelperFactory;
    readonly jobs: Pick<JobRegistry, "start">;
    readonly monotonicNow?: () => number;
    readonly now: () => number;
    readonly repository: MeetingRepository;
    readonly worker: RecordingSessionWorkerFactory;
}
export interface RecordingApplicationHost {
    activeRecording(meetingId: string): RecordingSession | null;
    claim(session: RecordingSession): JobHooks;
    currentRecording(): RecordingSession | null;
    draftSource(meetingId: string): {
        snapshot(): DraftTranscriptSnapshot;
    } | null;
    release(session: RecordingSession): void;
    requireIdle(): void;
}
export declare class RecordingApplication {
    private readonly dependencies;
    private readonly host;
    private readonly draftPages;
    private lastSession;
    constructor(dependencies: RecordingApplicationDependencies, host: RecordingApplicationHost);
    control(input: RecordingControlInput): Promise<RecordingSessionView>;
    state(): RecordingSessionView | null;
    preview(): readonly MeetingLiveSegment[];
    livePage(input: MeetingLivePageInput): MeetingLivePage;
    clear(): void;
    private admitStart;
    private start;
    private draftPage;
    private attachedDraftPage;
    private withCancellation;
}
