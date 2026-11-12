export interface SpeechBlock {
    readonly endMs: number;
    readonly speakerTurn: number;
    readonly startMs: number;
}
export interface SpeechRegion {
    readonly endMs: number;
    readonly startMs: number;
}
export declare function mergeSpeechBlocks(blocks: readonly SpeechBlock[], durationMs: number): SpeechRegion[];
export declare function splitSpeechRegions(regions: readonly SpeechRegion[]): SpeechRegion[];
