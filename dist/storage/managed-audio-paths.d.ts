import type { AudioSourceFormat } from "../audio/source-format.js";
import type { MeetingOrigin } from "./types.js";
export interface ManagedPaths {
    readonly audioPath: string;
    readonly audioTemporaryPath: string;
    readonly meetingDirectory: string;
    readonly sourcePath: string;
    readonly sourceTemporaryPath: string;
    readonly workDirectory: string;
}
export interface RecordingAudioLayout {
    readonly meetingDirectory: string;
    readonly recordingDirectory: string;
    readonly workRecordingDirectory: string;
}
export declare function managedPaths(root: string, meetingId: string, format: AudioSourceFormat): ManagedPaths;
export declare function recordingAudioLayout(root: string, meetingId: string): RecordingAudioLayout;
export declare function managedSourcePath(paths: ManagedPaths, origin: MeetingOrigin): string;
