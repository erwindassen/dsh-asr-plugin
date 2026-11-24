import type { RecordingHelperSubprocess } from "./helper-client.js";
export interface AudioDevice {
    /** CoreAudio UID; stable across launches and the value the capture child pins. */
    readonly uid: string;
    readonly name: string;
    readonly inputChannels: number;
    readonly outputChannels: number;
    readonly defaultInput: boolean;
    readonly defaultOutput: boolean;
}
export interface AudioDeviceInventory {
    readonly defaultInputUID: string | null;
    readonly defaultOutputUID: string | null;
    readonly devices: readonly AudioDevice[];
}
export interface AudioDeviceService {
    list(signal?: AbortSignal): Promise<AudioDeviceInventory>;
}
export declare class AudioDeviceError extends Error {
    readonly code: string;
    constructor(code: string, options?: ErrorOptions);
}
/** Parses the helper's `__devices` payload; unknown shapes are rejected wholesale. */
export declare function parseAudioDeviceInventory(value: unknown): AudioDeviceInventory;
export interface AudioDeviceServiceOptions {
    /** Resolves the signed helper bundle root. */
    readonly resolveApp: () => Promise<string>;
    readonly subprocess: RecordingHelperSubprocess;
    readonly timeoutMs?: number;
}
/**
 * Enumerates CoreAudio devices through the recording helper. The helper owns
 * the CoreAudio binding, so the Host never needs its own audio dependency.
 */
export declare function createAudioDeviceService(options: AudioDeviceServiceOptions): AudioDeviceService;
