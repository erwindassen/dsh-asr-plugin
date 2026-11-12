export interface FunAsrCmvn {
    readonly addShift: Float32Array;
    readonly rescale: Float32Array;
}
export interface LfrFeatures {
    readonly data: Float32Array;
    readonly frames: number;
}
export declare function applyLfr(inputs: Float32Array, frames: number, featureDim: number, lfrM: number, lfrN: number): LfrFeatures;
export declare function applyCmvn(inputs: Float32Array, frames: number, featureDim: number, cmvn: FunAsrCmvn): Float32Array;
