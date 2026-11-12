import type { ProcessingLaunch } from "../worker/processing-launch.js";
import type { WorkerLaunchSpec } from "../worker/process.js";
export interface PackagedRecordingWorkerLaunchOptions {
    readonly processing?: ProcessingLaunch;
    readonly modelRoot: string;
    readonly packagedNativeRoot: string;
    readonly manifestPath: string;
    readonly meetingsRoot: string;
    readonly workRoot: string;
    readonly meetingId: string;
    readonly runId: string;
    readonly expectedFingerprint: string;
    readonly graceMs: number;
}
export declare function createPackagedRecordingWorkerLaunch(options: PackagedRecordingWorkerLaunchOptions): WorkerLaunchSpec;
