import { createFunAsrRuntimeFactory } from "./funasr/factory.js";
import { loadParakeetRecognizer } from "./parakeet/recognizer.js";
import { WorkerRuntimeError } from "../worker/worker-errors.js";
/**
 * Recognizer weights are family-specific; the shared acoustic assets (VAD,
 * speaker embedding) are language agnostic and belong to no engine.
 */
export function recognitionAssetIds(engine) {
    return engine === "parakeet"
        ? ["parakeet-encoder", "parakeet-decoder", "parakeet-joiner", "parakeet-tokens"]
        : ["asr-cmvn", "asr-config", "asr-model", "asr-tokens"];
}
/**
 * Parakeet is self-punctuating, so it never loads the punctuation pack.
 */
export function punctuationAssetIds(mode, engine) {
    return mode === "enhanced" && engine !== "parakeet"
        ? ["punc-config", "punc-model", "punc-tokens"] : [];
}
/**
 * Loads the recognizer of the selected family once per Worker. The returned
 * punctuator loader is undefined for self-punctuating engines.
 */
export async function loadRecognitionEngine(engine, paths) {
    if (engine === "parakeet") {
        const recognizer = await loadParakeetRecognizer({
            paths: {
                decoderPath: paths.parakeetDecoderPath,
                encoderPath: paths.parakeetEncoderPath,
                joinerPath: paths.parakeetJoinerPath,
                tokensPath: paths.parakeetTokensPath,
            },
        });
        return { engine, recognizer, loadPunctuator: undefined };
    }
    const factory = createFunAsrRuntimeFactory({
        asrCmvnPath: paths.asrCmvnPath,
        asrConfigPath: paths.asrConfigPath,
        asrModelPath: paths.asrModelPath,
        asrTokensPath: paths.asrTokensPath,
        fbankPath: paths.fbankPath,
        punctuationConfigPath: paths.punctuationConfigPath,
        punctuationModelPath: paths.punctuationModelPath,
        punctuationTokensPath: paths.punctuationTokensPath,
    });
    const load = factory.loadPunctuator;
    return {
        engine,
        recognizer: await factory.loadRecognizer(),
        loadPunctuator: load === undefined ? undefined : () => load(),
    };
}
export function requireEnginePath(paths, id) {
    const path = paths[id];
    if (path === undefined) {
        throw new WorkerRuntimeError("ASSET_MISMATCH", "Required Worker asset is missing");
    }
    return path;
}
//# sourceMappingURL=recognition.js.map