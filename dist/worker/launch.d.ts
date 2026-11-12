import type { ProcessingLaunch } from "./processing-launch.js";
import type { WorkerLaunchSpec } from "./process.js";
import type { WorkerKind } from "./types.js";
export declare function createWorkerEnvironment(source?: Readonly<NodeJS.ProcessEnv>): Record<string, string>;
export interface PackagedWorkerLaunchOptions {
    readonly kind: WorkerKind;
    readonly processing?: ProcessingLaunch;
    readonly modelRoot: string;
    readonly packagedNativeRoot: string;
    readonly manifestPath: string;
    readonly managedAudioDirectory: string;
    readonly graceMs: number;
}
export declare function createPackagedWorkerLaunch(options: PackagedWorkerLaunchOptions): WorkerLaunchSpec;
