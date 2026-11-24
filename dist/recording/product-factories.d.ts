import type { RecordingHelperSignatureInspector } from "../assets/recording-helper-assets.js";
import type { ResolvedRuntimeAssets } from "../assets/runtime-assets.js";
import { type DshSubprocessPort } from "../worker/dsh-spawner.js";
import { type RecordingHelperCaptureDevices, type RecordingHelperSubprocess } from "./helper-client.js";
import { type AudioDeviceService } from "./audio-devices.js";
import type { RecordingSessionHelperFactory, RecordingSessionWorkerFactory } from "./recording-session.js";
import { RecordingPermissionsService } from "./permissions.js";
export interface ProductRecordingFactoriesOptions {
    readonly expectedFingerprint: string;
    readonly inspectHelperSignature: RecordingHelperSignatureInspector;
    readonly packageRoot: string;
    readonly runtimeAssets: () => Promise<ResolvedRuntimeAssets>;
    readonly subprocess: DshSubprocessPort & RecordingHelperSubprocess;
    /** Live capture device selection; empty uids mean the macOS defaults. */
    readonly devices?: () => RecordingHelperCaptureDevices;
}
export declare function createProductRecordingFactories(options: ProductRecordingFactoriesOptions): {
    readonly helper: RecordingSessionHelperFactory;
    readonly worker: RecordingSessionWorkerFactory;
    readonly permissions: RecordingPermissionsService;
    readonly devices: AudioDeviceService;
    readonly checkPermissions: (signal?: AbortSignal) => Promise<void>;
};
