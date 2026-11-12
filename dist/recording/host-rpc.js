import { RECORDING_RPC_CHANNEL, } from "./rpc-contract.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function record(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function exact(value, keys) {
    return Object.keys(value).every((key) => keys.includes(key));
}
function inputError() {
    throw new Error("INVALID_INPUT");
}
function emptyPayload(payload) {
    const value = record(payload);
    if (value === null || Object.keys(value).length !== 0)
        inputError();
}
function control(payload, signal) {
    const value = record(payload);
    if (value === null || !exact(value, ["action", "meeting_id", "title"]) ||
        typeof value.action !== "string")
        inputError();
    const action = value.action;
    if (action === "start") {
        if (value.meeting_id !== undefined ||
            (value.title !== undefined && typeof value.title !== "string"))
            inputError();
        return {
            action,
            signal,
            ...(value.title === undefined ? {} : { title: value.title }),
        };
    }
    if (!["stop", "mic_on", "mic_off", "system_on", "system_off"].includes(action) ||
        typeof value.meeting_id !== "string" || value.title !== undefined)
        inputError();
    return { action, meetingId: value.meeting_id, signal };
}
function failure(error) {
    const code = typeof error === "object" && error !== null && "code" in error &&
        typeof error.code === "string" ? error.code : "ENGINE_FAILURE";
    return { ok: false, error: { code: "internal", message: code, details: {} } };
}
function referenceCandidatesPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["session_id", "locale", "query"])
        || typeof value.session_id !== "string" || value.session_id.length < 1
        || value.session_id.length > 500 || typeof value.locale !== "string"
        || (value.query !== undefined && typeof value.query !== "string"))
        inputError();
    return {
        session_id: value.session_id,
        locale: value.locale,
        ...(value.query === undefined ? {} : { query: value.query }),
    };
}
function referenceResolvePayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["locale", "meeting_id"])
        || typeof value.locale !== "string"
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id))
        inputError();
    return { locale: value.locale, meeting_id: value.meeting_id };
}
function referenceValue(candidate) {
    const timestamp = (value) => value === null ? null : new Date(value).toISOString();
    return {
        meeting_id: candidate.meetingId,
        label: candidate.label,
        origin: candidate.origin,
        phase: candidate.phase,
        started_at: timestamp(candidate.startedAtMs),
        created_at: timestamp(candidate.createdAtMs),
        recording_elapsed_ms: candidate.recordingElapsedMs,
        duration_ms: candidate.durationMs,
    };
}
export function registerRecordingHostRpc(connection, application, modelStatus, downloads, permissions, prepareModels) {
    return connection.rpc.handle(RECORDING_RPC_CHANNEL, async (endpoint, payload, signal) => {
        try {
            if (endpoint === "models/prepare" && prepareModels !== undefined) {
                emptyPayload(payload);
                await prepareModels(signal);
                return { ok: true, value: null };
            }
            if (endpoint.startsWith("permissions/") && permissions !== undefined) {
                if (endpoint === "permissions/open-settings") {
                    const value = record(payload);
                    if (value === null || !exact(value, ["track"]) ||
                        (value.track !== "microphone" && value.track !== "system"))
                        inputError();
                    await permissions.openSettings(value.track, signal);
                    return { ok: true, value: null };
                }
                emptyPayload(payload);
                if (endpoint === "permissions/status")
                    return { ok: true, value: await permissions.read(signal) };
                if (endpoint === "permissions/test") {
                    const phase = application.getRecordingState()?.phase;
                    if (phase !== undefined && ["starting", "recording", "finalizing"].includes(phase)) {
                        throw Object.assign(new Error("Recording is active"), { code: "ENGINE_BUSY" });
                    }
                    return { ok: true, value: await permissions.test(signal) };
                }
            }
            if (endpoint.startsWith("models/download/") && downloads !== undefined) {
                if (endpoint === "models/download/start") {
                    const value = record(payload);
                    if (value === null || !exact(value, ["pack"]) ||
                        (value.pack !== "base" && value.pack !== "parakeet" &&
                            value.pack !== "punctuation"))
                        inputError();
                    return { ok: true, value: await downloads.start(value.pack) };
                }
                emptyPayload(payload);
                if (endpoint === "models/download/status")
                    return { ok: true, value: downloads.status() };
                if (endpoint === "models/download/cancel")
                    return { ok: true, value: await downloads.cancel() };
            }
            if (endpoint === "models/status" && modelStatus !== undefined) {
                emptyPayload(payload);
                return { ok: true, value: await modelStatus(signal) };
            }
            if (endpoint === "state") {
                emptyPayload(payload);
                return {
                    ok: true,
                    value: {
                        recording: application.getRecordingState(),
                        preview: application.getRecordingPreview(),
                        hasRecordingHistory: application.hasRecordingHistory(),
                    },
                };
            }
            if (endpoint === "control") {
                return { ok: true, value: await application.controlRecording(control(payload, signal)) };
            }
            if (endpoint === "references/candidates") {
                const request = referenceCandidatesPayload(payload);
                return {
                    ok: true,
                    value: application.getMeetingReferenceCandidates({
                        locale: request.locale,
                        ...(request.query === undefined ? {} : { query: request.query }),
                    }).map(referenceValue),
                };
            }
            if (endpoint === "references/resolve") {
                const request = referenceResolvePayload(payload);
                return {
                    ok: true,
                    value: referenceValue(application.resolveMeetingReference({
                        locale: request.locale,
                        meetingId: request.meeting_id,
                    })),
                };
            }
            throw new Error("UNKNOWN_ENDPOINT");
        }
        catch (error) {
            return failure(error);
        }
    }, { authority: "loopback" });
}
//# sourceMappingURL=host-rpc.js.map