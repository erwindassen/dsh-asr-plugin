const WORKER_CODES = new Set([
    "INVALID_REQUEST",
    "ASSET_MISMATCH",
    "AUDIO_READ_FAILED",
    "MODEL_LOAD_FAILED",
    "MODEL_INFERENCE_FAILED",
    "NATIVE_LOAD_FAILED",
    "NATIVE_FAILURE",
    "RESOURCE_LIMIT",
    "INTERNAL_ERROR",
]);
const MESSAGES = {
    INVALID_REQUEST: "Worker request is invalid",
    ASSET_MISMATCH: "Worker assets failed verification",
    AUDIO_READ_FAILED: "Managed audio could not be read",
    MODEL_LOAD_FAILED: "Model failed to load",
    MODEL_INFERENCE_FAILED: "Model inference failed",
    NATIVE_LOAD_FAILED: "Native runtime failed to load",
    NATIVE_FAILURE: "Native runtime failed",
    RESOURCE_LIMIT: "Worker resource limit was exceeded",
    INTERNAL_ERROR: "Worker failed internally",
};
export class WorkerRuntimeError extends Error {
    code;
    stage;
    constructor(code, message, stage, options) {
        super(message, options);
        this.code = code;
        this.stage = stage;
        this.name = "WorkerRuntimeError";
    }
}
function rawCode(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return undefined;
    return typeof error.code === "string" ? error.code : undefined;
}
function mapCode(error) {
    const code = rawCode(error);
    if (code !== undefined && WORKER_CODES.has(code)) {
        return code;
    }
    if (code?.startsWith("ASSET_") === true ||
        code === "MANIFEST_INVALID" ||
        code === "RUNTIME_MISMATCH")
        return "ASSET_MISMATCH";
    if (code === "INPUT_INVALID" || code === "NATIVE_INPUT_INVALID")
        return "INVALID_REQUEST";
    if (code === "NATIVE_LOAD_FAILED")
        return "NATIVE_LOAD_FAILED";
    if (code?.startsWith("NATIVE_") === true)
        return "NATIVE_FAILURE";
    return "INTERNAL_ERROR";
}
function stageFrom(error) {
    if (typeof error !== "object" || error === null || !("stage" in error))
        return undefined;
    return typeof error.stage === "string" ? error.stage : undefined;
}
function allowedStage(kind, stage) {
    if (stage === "initializing")
        return true;
    return kind === "asr"
        ? stage === "vad" || stage === "asr"
        : stage === "fbank" || stage === "embed" || stage === "cluster" || stage === "assign";
}
export function sanitizeWorkerFailure(error, kind, fallbackStage) {
    const code = mapCode(error);
    const candidate = stageFrom(error);
    const stage = candidate !== undefined && allowedStage(kind, candidate)
        ? candidate
        : fallbackStage;
    return { code, message: MESSAGES[code], stage };
}
export function stageWorkerFailure(error, kind, stage) {
    const failure = sanitizeWorkerFailure(error, kind, stage);
    return new WorkerRuntimeError(failure.code, failure.message, stage, { cause: error });
}
//# sourceMappingURL=worker-errors.js.map