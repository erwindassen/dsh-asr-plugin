import type { MeetingDiarizer, SpeakerClusterer, SpeakerEmbeddingModel } from "./meeting-diarizer.js";
export interface MeetingDiarizerAssetPaths {
    readonly embeddingModelPath: string;
    readonly fbankPath: string;
    readonly hclusterPath: string;
}
export interface LoadedMeetingDiarizationComponents {
    readonly clusterer: SpeakerClusterer;
    readonly embeddingModel: SpeakerEmbeddingModel;
}
export declare function loadMeetingDiarizationComponents(paths: MeetingDiarizerAssetPaths): Promise<LoadedMeetingDiarizationComponents>;
export declare function loadMeetingDiarizer(paths: MeetingDiarizerAssetPaths): Promise<MeetingDiarizer>;
