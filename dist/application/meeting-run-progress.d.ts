import type { WorkerProgressMessage } from "../worker/types.js";
export type MeetingRunStage = "validating" | "normalizing" | "loading_asr" | "transcribing" | "loading_diarization" | "diarizing" | "committing" | "cleaning";
export declare class ProgressOutput {
    private readonly startedAtMs;
    private readonly now;
    private stageValue;
    private percentValue;
    private terminal;
    private unread;
    constructor(startedAtMs: number, now: () => number);
    get stage(): MeetingRunStage;
    update(stage: MeetingRunStage, percent: number): void;
    finish(stage: MeetingRunStage, errorCode?: string): void;
    read(): string;
    private render;
}
export declare function workerPercent(kind: "asr" | "diarization", message: WorkerProgressMessage): number;
