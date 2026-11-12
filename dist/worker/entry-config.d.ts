import type { ProcessingLaunch } from "./processing-launch.js";
export interface WorkerEntryConfig {
    readonly processing?: ProcessingLaunch;
    readonly modelRoot: string;
    readonly packagedNativeRoot: string;
    readonly manifestPath: string;
    readonly managedAudioDirectory: string;
}
export declare function parseWorkerEntryConfig(argv: readonly string[]): WorkerEntryConfig;
