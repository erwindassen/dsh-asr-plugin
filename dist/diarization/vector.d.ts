export declare const SPEAKER_EMBEDDING_DIMENSIONS = 256;
export declare function l2Normalize(vector: Float32Array): Float32Array;
export declare function normalizedCentroid(embeddings: readonly Float32Array[]): Float32Array;
export declare function cosineDistance(first: Float32Array, second: Float32Array): number;
export declare function centerFeatures(features: Float32Array, frames: number, melBins: number): void;
