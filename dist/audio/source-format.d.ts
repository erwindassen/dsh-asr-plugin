import type { FileHandle } from "node:fs/promises";
export type AudioSourceFormat = "wav" | "m4a" | "mp3";
export declare function detectAudioSourceFormat(handle: FileHandle, fileSize: number): Promise<AudioSourceFormat | null>;
