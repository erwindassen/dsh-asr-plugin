import type { SubprocessHandle, SubprocessSpawnSpec } from "@deepseek-ai/dsh-subprocess";
import type { AudioSourceFormat } from "./source-format.js";
export interface AudioConversionSubprocess {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
export interface NormalizedAudio {
    readonly audioPath: string;
    readonly durationMs: number;
    readonly frameCount: number;
}
export interface NormalizeManagedAudioInput {
    readonly audioPath: string;
    readonly audioTemporaryPath: string;
    readonly conversionDeadline?: (() => AbortSignal) | undefined;
    readonly meetingDirectory: string;
    readonly signal?: AbortSignal | undefined;
    readonly sourceFormat: AudioSourceFormat;
    readonly sourcePath: string;
    readonly subprocess: AudioConversionSubprocess;
    readonly workDirectory: string;
}
export declare function normalizeManagedAudio(input: NormalizeManagedAudioInput): Promise<NormalizedAudio>;
