import type { SpeakerEmbeddingModel } from "./meeting-diarizer.js";
/** Below this distance a segment joins an existing speaker, matching the final diarizer. */
export declare const ONLINE_MAX_CENTROID_DISTANCE = 0.7;
/** Live transcription never grows past this many speakers; the rest report UNKNOWN. */
export declare const ONLINE_MAX_SPEAKERS = 8;
export interface OnlineSpeakerLabelerOptions {
    readonly embedding: SpeakerEmbeddingModel;
    readonly maxDistance?: number;
    readonly maxSpeakers?: number;
}
export interface OnlineSpeakerLabeler {
    /** Labels one segment of speech; short or ambiguous audio stays unlabeled. */
    label(samples: Float32Array): Promise<string | null>;
    readonly speakerCount: number;
}
/**
 * Incremental speaker clustering for the live transcript.
 *
 * The final transcript clusters every segment after the recording ends, which
 * cannot drive a preview. This labeler keeps running centroids instead: a new
 * segment joins the nearest speaker when the cosine distance is small enough,
 * and otherwise opens a new one. Labels stay stable across draft revisions
 * because the state lives for the whole recording.
 */
export declare function createOnlineSpeakerLabeler(options: OnlineSpeakerLabelerOptions): OnlineSpeakerLabeler;
