import type { SubprocessHandle, SubprocessSpawnSpec } from "@deepseek-ai/dsh-subprocess";
export interface DirectoryPickerRequest {
    /** Folder the dialog opens in; the dialog falls back to its own default when absent. */
    readonly defaultDirectory?: string;
    readonly prompt: string;
    readonly signal?: AbortSignal;
}
/** Resolves an absolute folder path, or null when the user cancelled the dialog. */
export interface DirectoryPicker {
    choose(request: DirectoryPickerRequest): Promise<string | null>;
}
export interface DirectoryPickerSubprocess {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
/**
 * AppleScript that shows the standard macOS folder chooser. `activate` brings
 * the dialog to the front for hosts that run without a foreground window.
 */
export declare function buildFolderPickerScript(prompt: string, defaultDirectory?: string): string[];
export interface FolderPickerFailure {
    readonly cancelled: boolean;
    readonly reason: string;
}
/**
 * osascript reports a cancelled dialog as exit 1 with a user-cancel error code
 * and reports real AppleScript failures the same way, so the two are separated
 * here by the message instead of the exit status.
 */
export declare function classifyFolderPickerFailure(stderr: string): FolderPickerFailure;
export type PickerErrorKind = "cancelled" | "timeout" | "failed";
export declare class PickerError extends Error {
    readonly kind: PickerErrorKind;
    readonly detail: string;
    constructor(kind: PickerErrorKind, detail?: string);
}
export interface MacDirectoryPickerOptions {
    readonly subprocess: DirectoryPickerSubprocess;
    readonly timeoutMs?: number;
}
export declare function createMacDirectoryPicker(options: MacDirectoryPickerOptions): DirectoryPicker;
