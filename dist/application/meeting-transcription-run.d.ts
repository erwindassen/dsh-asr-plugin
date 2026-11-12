import type { JobOutputSource } from "@deepseek-ai/dsh-jobs";
import type { ProcessingIdentity } from "../assets/processing-identity.js";
import type { JobHooks } from "@deepseek-ai/dsh-jobs";
import type { ManagedAudioStore, VerifiedAudioInput } from "../storage/managed-audio-store.js";
import { type MeetingRecord, type MeetingRepository } from "../storage/meeting-repository.js";
import { type WorkerRunner } from "../worker/worker-pipeline.js";
export type { MeetingRunStage } from "./meeting-run-progress.js";
export interface MeetingTranscriptionRunIdentity {
    readonly baseVersion: number;
    readonly meetingId: string;
    readonly runId: string;
    readonly title: string;
    readonly startedAtMs: number;
}
export interface MeetingTranscriptionRunDependencies {
    readonly processingIdentity?: ProcessingIdentity;
    readonly asr: WorkerRunner;
    readonly audioStore: ManagedAudioStore;
    readonly diarization: WorkerRunner;
    readonly engineFingerprint: string;
    readonly now: () => number;
    readonly repository: MeetingRepository;
}
export type MeetingTranscriptionSource = {
    readonly kind: "import";
    readonly input: VerifiedAudioInput;
} | {
    readonly kind: "retranscribe";
    readonly meeting: MeetingRecord;
};
export declare class MeetingTranscriptionRun {
    readonly identity: MeetingTranscriptionRunIdentity;
    private readonly source;
    private readonly dependencies;
    private readonly release;
    readonly hooks: JobHooks;
    readonly output: JobOutputSource;
    private readonly controller;
    private readonly progress;
    private decision;
    private jobIdValue;
    private resolveDone;
    constructor(identity: MeetingTranscriptionRunIdentity, source: MeetingTranscriptionSource, dependencies: MeetingTranscriptionRunDependencies, release: (run: MeetingTranscriptionRun) => void);
    get jobId(): string | null;
    claim(): void;
    publish(jobId: string): void;
    closeUnclaimed(): Promise<void>;
    private timestamp;
    private cancel;
    private execute;
    private runPipeline;
    private prepareAudio;
    private prepareImportedAudio;
    private commit;
    private decisionFrom;
    private linearizeFailure;
    private releaseResources;
    private withCleanupFailure;
}
