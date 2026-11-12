import { resolve } from "node:path";
import * as ort from "onnxruntime-node";
import { VadProcessingError } from "./errors.js";
import { VAD_CLASSES, VAD_OUTPUT_FRAMES, VAD_WINDOW_SAMPLES, } from "./bounded-vad.js";
const INPUT_NAME = "input_values";
const OUTPUT_NAME = "logits";
function loadFailure(message, cause) {
    return new VadProcessingError("MODEL_LOAD_FAILED", message, cause === undefined ? undefined : { cause });
}
function inferenceFailure(message, cause) {
    return new VadProcessingError("MODEL_INFERENCE_FAILED", message, cause === undefined ? undefined : { cause });
}
function assertSessionContract(session) {
    if (!session.inputNames.includes(INPUT_NAME) ||
        !session.outputNames.includes(OUTPUT_NAME)) {
        throw loadFailure("VAD model I/O contract mismatch");
    }
}
function copyLogits(value, batchWindows) {
    if (!(value instanceof ort.Tensor) ||
        !(value.data instanceof Float32Array) ||
        value.dims.length !== 3 ||
        value.dims[0] !== batchWindows ||
        value.dims[1] !== VAD_OUTPUT_FRAMES ||
        value.dims[2] !== VAD_CLASSES) {
        throw inferenceFailure("VAD model returned an invalid logits tensor");
    }
    return new Float32Array(value.data);
}
async function runSession(session, input, batchWindows) {
    const tensor = new ort.Tensor("float32", input, [
        batchWindows,
        1,
        VAD_WINDOW_SAMPLES,
    ]);
    let results;
    try {
        results = await session.run({ [INPUT_NAME]: tensor });
        return copyLogits(results[OUTPUT_NAME], batchWindows);
    }
    catch (error) {
        if (error instanceof VadProcessingError)
            throw error;
        throw inferenceFailure("VAD ONNX inference failed", error);
    }
    finally {
        tensor.dispose();
        if (results !== undefined) {
            for (const value of Object.values(results))
                value.dispose();
        }
    }
}
export async function loadVadModel(modelPath) {
    let session;
    try {
        session = await ort.InferenceSession.create(resolve(modelPath), {
            executionProviders: ["cpu"],
            logSeverityLevel: 3,
            logVerbosityLevel: 0,
        });
        assertSessionContract(session);
    }
    catch (error) {
        await session?.release().catch(() => undefined);
        if (error instanceof VadProcessingError)
            throw error;
        throw loadFailure("VAD ONNX model failed to load", error);
    }
    const loadedSession = session;
    let closed = false;
    return {
        async close() {
            if (closed)
                return;
            closed = true;
            await loadedSession.release();
        },
        async infer(input, batchWindows) {
            if (closed)
                throw inferenceFailure("VAD model is closed");
            return runSession(loadedSession, input, batchWindows);
        },
    };
}
//# sourceMappingURL=vad-model.js.map