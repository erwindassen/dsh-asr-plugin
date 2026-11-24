import type { SubprocessHandle, SubprocessSpawnSpec } from "@deepseek-ai/dsh-subprocess";
import type { RecordingAudioLayout } from "../storage/managed-audio-store.js";
import type { RecordingHelperSession, RecordingSessionHelperFactory } from "./recording-session.js";
export interface RecordingHelperSubprocess {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
export interface RecordingHelperCaptureDevices {
    /** CoreAudio UID for the microphone track; empty means the macOS default. */
    readonly mic: string;
    /** CoreAudio UID for the system tap; empty means the macOS default. */
    readonly system: string;
}
export interface RecordingHelperClientOptions {
    readonly appRoot: string;
    readonly commandTimeoutMs: number;
    readonly hostProcessId: number;
    readonly readyTimeoutMs: number;
    readonly subprocess: RecordingHelperSubprocess;
    readonly terminationTimeoutMs: number;
    /** Live device selection; read per recording so a panel change needs no restart. */
    readonly devices?: () => RecordingHelperCaptureDevices;
}
export declare class RecordingHelperClientError extends Error {
    readonly code: string;
    constructor(code: string, options?: ErrorOptions);
}
export declare class RecordingHelperClient implements RecordingSessionHelperFactory {
    private readonly options;
    constructor(options: RecordingHelperClientOptions);
    start(input: {
        readonly layout: RecordingAudioLayout;
        readonly meetingId: string;
        readonly signal: AbortSignal;
    }): Promise<RecordingHelperSession>;
}
