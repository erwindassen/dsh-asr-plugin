import { createRequire } from "node:module";
import { FunAsrError } from "../funasr/errors.js";
import { parakeetChunkText } from "./text.js";
const require = createRequire(import.meta.url);
const SAMPLE_RATE = 16_000;
const DEFAULT_THREADS = 2;
function loadSherpa() {
    try {
        return require("sherpa-onnx-node");
    }
    catch (error) {
        throw new FunAsrError("MODEL_LOAD_FAILED", "sherpa-onnx runtime is unavailable", { cause: error });
    }
}
function recognizerConfig(paths, numThreads) {
    return {
        featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
        modelConfig: {
            transducer: { encoder: paths.encoderPath, decoder: paths.decoderPath, joiner: paths.joinerPath },
            tokens: paths.tokensPath,
            numThreads,
            provider: "cpu",
            debug: 0,
        },
        decodingMethod: "greedy_search",
    };
}
function resultDraft(result, samples) {
    const durationMs = Math.max(1, Math.round((samples / SAMPLE_RATE) * 1_000));
    const text = parakeetChunkText({
        tokens: result.tokens ?? [],
        timestamps: result.timestamps ?? [],
    }, durationMs);
    return {
        featureFrames: Math.max(1, Math.round(samples / 160)),
        frontendMs: 0,
        inferenceMs: 0,
        puncInput: text.puncInput,
        punctuation: text.punctuation,
        rawText: text.rawText,
        timestampsMs: text.timestampsMs,
        tokenCount: text.tokens.length,
        tokens: text.tokens,
    };
}
/**
 * Loads the transducer recognizer once per Worker and reuses it for every
 * chunk. NeMo v3 checkpoints emit casing and punctuation, so no separate
 * punctuator is loaded for this engine.
 */
export async function loadParakeetRecognizer(config) {
    const sherpa = loadSherpa();
    let recognizer;
    try {
        recognizer = new sherpa.OfflineRecognizer(recognizerConfig(config.paths, config.numThreads ?? DEFAULT_THREADS));
    }
    catch (error) {
        throw new FunAsrError("MODEL_LOAD_FAILED", "Parakeet recognizer failed to load", { cause: error });
    }
    return {
        async close() {
            return Promise.resolve();
        },
        async recognize(samples) {
            if (!(samples instanceof Float32Array) || samples.length === 0) {
                throw new FunAsrError("MODEL_INFERENCE_FAILED", "Parakeet received empty audio");
            }
            const stream = recognizer.createStream();
            stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
            const started = performance.now();
            let result;
            try {
                recognizer.decode(stream);
                result = recognizer.getResult(stream);
            }
            catch (error) {
                throw new FunAsrError("MODEL_INFERENCE_FAILED", "Parakeet recognition failed", { cause: error });
            }
            const inferenceMs = performance.now() - started;
            return { ...resultDraft(result, samples.length), inferenceMs };
        },
    };
}
//# sourceMappingURL=recognizer.js.map