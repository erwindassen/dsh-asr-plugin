export interface TimestampDecodeOptions {
    readonly beginTimeMs?: number;
    readonly maxTokenDuration?: number;
    readonly totalOffset?: number;
    readonly upsampleRate?: number;
}
export declare function decodeBiCifTokenTimestamps(rawTokens: readonly string[], usCifPeak: Float32Array, usAlphas?: Float32Array | null, options?: TimestampDecodeOptions): Array<[number, number]>;
