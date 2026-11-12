import type { Pcm16WavReader } from "../audio/wav-reader.js";
export declare function prepareManagedAudioRoot(directory: string): Promise<string>;
export declare function openManagedPcm16Wav(managedRoot: string, audioPath: string, durationMs: number): Promise<Pcm16WavReader>;
