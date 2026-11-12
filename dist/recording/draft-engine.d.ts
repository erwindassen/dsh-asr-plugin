import type { ClosedRecordingChunks } from "../audio/closed-recording-chunks.js";
import type { RecordingRevisionMessage } from "./worker-types.js";
export declare class RecordingDraftResourceError extends Error {
    readonly code: "RESOURCE_LIMIT";
    constructor(message: string);
}
export interface RecordingDraftUnit {
    readonly breakAfter: boolean;
    readonly endMs: number;
    readonly startMs: number;
    readonly text: string;
}
export type RecordingDraftRecognizer = (samples: Float32Array) => Promise<readonly RecordingDraftUnit[]>;
export interface RecordingDraftEngineOptions {
    readonly chunks: ClosedRecordingChunks;
    readonly recognize: RecordingDraftRecognizer;
    readonly now?: () => number;
}
export declare class RecordingDraftEngine {
    private readonly options;
    private readonly now;
    private originUs;
    private processedThroughFrames;
    private revision;
    private units;
    private segments;
    constructor(options: RecordingDraftEngineOptions);
    nextRevision(): Promise<RecordingRevisionMessage | null>;
    private plan;
    private message;
    private accept;
}
