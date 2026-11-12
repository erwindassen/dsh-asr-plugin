export declare const PCM_SAMPLE_RATE = 16000;
export declare const MAX_AUDIO_FRAMES: number;
export declare const MAX_PCM_RANGE_FRAMES: number;
export interface Pcm16WavMetadata {
    readonly bitDepth: 16;
    readonly channels: 1;
    readonly dataByteLength: number;
    readonly dataOffset: number;
    readonly durationMs: number;
    readonly frameCount: number;
    readonly sampleRate: 16_000;
}
export interface Pcm16WavReader {
    readonly metadata: Pcm16WavMetadata;
    close(): Promise<void>;
    readFrames(startFrame: number, endFrame: number): Promise<Float32Array>;
    readFramesInto(startFrame: number, endFrame: number, target: Float32Array, targetOffset?: number): Promise<void>;
}
export declare function openPcm16Wav(filePath: string): Promise<Pcm16WavReader>;
