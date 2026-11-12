import type { SpeakerEmbeddingModel } from "./meeting-diarizer.js";
export interface SpeakerEmbeddingModelPaths {
    readonly fbankPath: string;
    readonly modelPath: string;
}
export declare function loadSpeakerEmbeddingModel(paths: SpeakerEmbeddingModelPaths): Promise<SpeakerEmbeddingModel>;
