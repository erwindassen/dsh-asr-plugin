import { parseRecordingFinalizeMessage, parseRecordingWorkerMessage } from "./worker-messages.js";
function invalid() {
    throw Object.assign(new Error("Recording model protocol is invalid"), { code: "INVALID_REQUEST" });
}
function exact(value, keys) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        invalid();
    const record = value;
    if (Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key)))
        invalid();
    return record;
}
function identity(value) {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))
        invalid();
    return value;
}
export function parseModelHostMessage(value) {
    const type = exactType(value);
    if (type === "begin") {
        const item = exact(value, ["type", "meeting_id", "run_id"]);
        return { type, meeting_id: identity(item.meeting_id), run_id: identity(item.run_id) };
    }
    if (type === "input") {
        const item = exact(value, ["type", "run_id", "payload"]);
        return { type, run_id: identity(item.run_id), payload: parseRecordingFinalizeMessage(item.payload) };
    }
    const item = exact(value, ["type", "run_id"]);
    if (type !== "input_end")
        invalid();
    return { type, run_id: identity(item.run_id) };
}
function exactType(value) {
    if (typeof value !== "object" || value === null || !("type" in value))
        invalid();
    return value.type;
}
export function parseModelWorkerMessage(value) {
    const type = exactType(value);
    if (type === "model_ready") {
        const item = exact(value, ["type", "model_protocol_version", "engine_fingerprint"]);
        if (item.model_protocol_version !== 1)
            invalid();
        if (typeof item.engine_fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(item.engine_fingerprint))
            invalid();
        return { type, model_protocol_version: 1, engine_fingerprint: item.engine_fingerprint };
    }
    if (type === "output") {
        const item = exact(value, ["type", "run_id", "payload"]);
        return { type, run_id: identity(item.run_id), payload: parseRecordingWorkerMessage(item.payload) };
    }
    const item = exact(value, ["type", "run_id", "exit_code"]);
    if (type !== "session_end" || (item.exit_code !== 0 && item.exit_code !== 1))
        invalid();
    return { type, run_id: identity(item.run_id), exit_code: item.exit_code };
}
//# sourceMappingURL=model-messages.js.map