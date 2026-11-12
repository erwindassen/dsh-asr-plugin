export interface MelFeatures {
    data: Float32Array;
    dims: readonly [frames: number, melBins: 80];
}
export interface Fbank {
    extract(samples: Float32Array): MelFeatures;
}
export declare function loadFbank(binaryPath: string): Fbank;
