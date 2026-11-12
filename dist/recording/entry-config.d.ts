import type { ProcessingLaunch } from "../worker/processing-launch.js";
export interface RecordingWorkerEntryConfig {
    readonly processing?: ProcessingLaunch;
    readonly modelRoot: string;
    readonly packagedNativeRoot: string;
    readonly manifestPath: string;
    readonly meetingsRoot: string;
    readonly workRoot: string;
    readonly meetingId: string;
    readonly runId: string;
    readonly expectedFingerprint: string;
}
export declare function parseRecordingWorkerEntryConfig(argv: readonly string[]): RecordingWorkerEntryConfig;
