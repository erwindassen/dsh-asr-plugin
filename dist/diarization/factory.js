import { NativeAdapterError } from "../native/errors.js";
import { loadHCluster } from "../native/hcluster.js";
import { loadSpeakerEmbeddingModel } from "./embedding-model.js";
import { DiarizationError } from "./errors.js";
import { createMeetingDiarizer } from "./meeting-diarizer.js";
export async function loadMeetingDiarizationComponents(paths) {
    let clusterer;
    try {
        clusterer = loadHCluster(paths.hclusterPath);
    }
    catch (error) {
        if (error instanceof NativeAdapterError) {
            throw new DiarizationError("NATIVE_LOAD_FAILED", "Speaker clusterer failed to load", {
                cause: error,
            });
        }
        throw error;
    }
    const embeddingModel = await loadSpeakerEmbeddingModel({
        fbankPath: paths.fbankPath,
        modelPath: paths.embeddingModelPath,
    });
    return { clusterer, embeddingModel };
}
export async function loadMeetingDiarizer(paths) {
    return createMeetingDiarizer(await loadMeetingDiarizationComponents(paths));
}
//# sourceMappingURL=factory.js.map