import type { ManagedAudioStore } from "../storage/managed-audio-store.js";
import type { CommitTranscriptResult, MeetingRepository } from "../storage/meeting-repository.js";
import type { RecordingWorkerSession } from "../recording/worker-client.js";
export declare const RECORDING_FINALIZATION_DEADLINE_MS = 30000;
export interface RecordingFinalizationIdentity {
    readonly baseVersion: number;
    readonly captureEndUs: number;
    readonly deadlineAtMs: number;
    readonly meetingId: string;
    readonly recordingEndedAtMs: number;
    readonly requestId: string;
    readonly runId: string;
}
export interface RecordingFinalizationDependencies {
    readonly audioStore: ManagedAudioStore;
    readonly engineFingerprint: string;
    readonly monotonicNow?: () => number;
    readonly now: () => number;
    readonly repository: MeetingRepository;
    readonly worker: RecordingWorkerSession;
}
export interface FinalizeRecordingRunInput {
    readonly dependencies: RecordingFinalizationDependencies;
    readonly identity: RecordingFinalizationIdentity;
}
export declare class RecordingFinalizationError extends Error {
    readonly code: string;
    constructor(code: string, options?: ErrorOptions);
}
export declare function waitForRecordingFinalization<T>(operation: Promise<T>, deadlineAtMs: number, monotonicNow: () => number): Promise<T>;
export declare function finalizeRecordingRun(input: FinalizeRecordingRunInput): Promise<CommitTranscriptResult>;
