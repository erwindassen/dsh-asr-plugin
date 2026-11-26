import { normalizeSpeakerName } from "../transcripts/speaker-attribution.js";
import { MeetingRepositoryError } from "../storage/errors.js";
import { DEFAULT_STORED_MEETINGS_LIMIT, MAX_STORED_MEETINGS_LIMIT, } from "../application/stored-meeting-panel.js";
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
const MAX_SPEAKER_ENTRIES = 64;
const MAX_SPEAKER_LABEL_LENGTH = 120;
const MAX_SPEAKER_NAME_INPUT_LENGTH = 200;
/** Wire shape of a label-to-name map; canonicality is judged by the export control. */
function speakerNameMap(value) {
    const map = record(value);
    if (map === null || Object.keys(map).length > MAX_SPEAKER_ENTRIES)
        inputError();
    for (const [label, name] of Object.entries(map)) {
        if (label === "" || label.length > MAX_SPEAKER_LABEL_LENGTH)
            inputError();
        if (typeof name !== "string" || name.length > MAX_SPEAKER_NAME_INPUT_LENGTH)
            inputError();
    }
    return map;
}
function speakerNamesPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["meeting_id"])
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id))
        inputError();
    return { meeting_id: value.meeting_id };
}
function saveSpeakerNamesPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["meeting_id", "speaker_names"])
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id)
        || !Object.hasOwn(value, "speaker_names"))
        inputError();
    return { meeting_id: value.meeting_id, speaker_names: speakerNameMap(value.speaker_names) };
}
/** Stored rows as a wire map, dropping names that are not canonical any more. */
function speakerNamesValue(store, meetingId) {
    const names = {};
    for (const entry of store.list(meetingId)) {
        const name = normalizeSpeakerName(entry.name);
        if (name !== "")
            names[entry.label] = name;
    }
    return names;
}
function meetingsListPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["limit"]))
        inputError();
    if (value.limit === undefined)
        return {};
    if (!Number.isSafeInteger(value.limit)
        || value.limit < 1
        || value.limit > MAX_STORED_MEETINGS_LIMIT)
        inputError();
    return { limit: value.limit };
}
function storedMeetingIdPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["meeting_id"])
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id))
        inputError();
    return { meeting_id: value.meeting_id };
}
function okfIngestPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["force", "meeting_id"])
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id)
        || (value.force !== undefined && typeof value.force !== "boolean"))
        inputError();
    return {
        meeting_id: value.meeting_id,
        ...(value.force === undefined ? {} : { force: value.force }),
    };
}
function meetingsSyncPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["apply"]))
        inputError();
    const apply = value["apply"];
    if (apply !== undefined && typeof apply !== "boolean")
        inputError();
    return apply === undefined ? {} : { apply };
}
function transcriptExportPayload(payload) {
    const value = record(payload);
    if (value === null || !exact(value, ["destination", "directory", "format", "include_speakers", "include_timestamps", "meeting_id", "speaker_names"])
        || (value.directory !== undefined && (typeof value.directory !== "string"
            || !value.directory.startsWith("/") || value.directory.length > 4_096))
        || (value.destination !== "default" && value.destination !== "choose")
        || !["md", "txt", "srt", "vtt"].includes(value.format)
        || typeof value.include_speakers !== "boolean" || typeof value.include_timestamps !== "boolean"
        || typeof value.meeting_id !== "string" || !UUID_PATTERN.test(value.meeting_id))
        inputError();
    if (Object.hasOwn(value, "speaker_names") && value.speaker_names !== undefined) {
        speakerNameMap(value.speaker_names);
    }
    return value;
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
export function registerRecordingHostRpc(connection, application, modelStatus, downloads, permissions, prepareModels, transcripts, devices, chooseOkfDirectory, speakerNames, panel) {
    return connection.rpc.handle(RECORDING_RPC_CHANNEL, async (endpoint, payload, signal) => {
        try {
            if (endpoint === "okf/choose-directory" && chooseOkfDirectory !== undefined) {
                emptyPayload(payload);
                return { ok: true, value: await chooseOkfDirectory(signal) };
            }
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
            if (endpoint === "devices/list" && devices !== undefined) {
                emptyPayload(payload);
                const inventory = await devices.list(signal);
                return {
                    ok: true,
                    value: {
                        default_input_uid: inventory.defaultInputUID,
                        default_output_uid: inventory.defaultOutputUID,
                        devices: inventory.devices.map((device) => ({
                            uid: device.uid,
                            name: device.name,
                            input_channels: device.inputChannels,
                            output_channels: device.outputChannels,
                            default_input: device.defaultInput,
                            default_output: device.defaultOutput,
                        })),
                    },
                };
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
            if (speakerNames !== undefined && (endpoint === "transcripts/speaker-names"
                || endpoint === "transcripts/save-speaker-names")) {
                if (endpoint === "transcripts/speaker-names") {
                    const request = speakerNamesPayload(payload);
                    return { ok: true, value: { speaker_names: speakerNamesValue(speakerNames, request.meeting_id) } };
                }
                const request = saveSpeakerNamesPayload(payload);
                speakerNames.replace(request.meeting_id, Object.entries(request.speaker_names)
                    .map(([label, name]) => ({ meetingId: request.meeting_id, label, name })));
                return { ok: true, value: { speaker_names: speakerNamesValue(speakerNames, request.meeting_id) } };
            }
            if (panel !== undefined && endpoint === "meetings/list") {
                const request = meetingsListPayload(payload);
                return {
                    ok: true,
                    value: {
                        items: panel.meetings.list(request.limit ?? DEFAULT_STORED_MEETINGS_LIMIT),
                    },
                };
            }
            if (panel !== undefined && endpoint === "meetings/transcript") {
                const request = storedMeetingIdPayload(payload);
                const transcript = panel.meetings.transcript(request.meeting_id);
                if (transcript === null) {
                    throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
                }
                return { ok: true, value: transcript };
            }
            if (panel !== undefined && endpoint === "meetings/sync" && panel.sync !== undefined) {
                const request = meetingsSyncPayload(payload);
                return { ok: true, value: await panel.sync(request.apply ?? false) };
            }
            if (panel !== undefined && endpoint === "okf/ingest") {
                const request = okfIngestPayload(payload);
                return {
                    ok: true,
                    value: await panel.ingestion.start(request.meeting_id, {
                        force: request.force ?? false,
                    }),
                };
            }
            if (panel !== undefined && endpoint === "okf/ingest/status") {
                const request = storedMeetingIdPayload(payload);
                return { ok: true, value: panel.ingestion.status(request.meeting_id) };
            }
            if (endpoint.startsWith("transcripts/") && transcripts !== undefined) {
                if (endpoint === "transcripts/choose-directory") {
                    emptyPayload(payload);
                    return { ok: true, value: await transcripts.chooseDirectory(signal) };
                }
                if (endpoint === "transcripts/export") {
                    const request = transcriptExportPayload(payload);
                    const outcome = await transcripts.exportTranscript({
                        ...(request.directory === undefined ? {} : { directory: request.directory }),
                        destination: request.destination,
                        format: request.format,
                        includeSpeakers: request.include_speakers,
                        includeTimestamps: request.include_timestamps,
                        meetingId: request.meeting_id,
                        ...(request.speaker_names === undefined ? {} : { speakerNames: request.speaker_names }),
                    }, signal);
                    return {
                        ok: true,
                        value: {
                            bytes: outcome.bytes,
                            format: outcome.format,
                            meeting_id: outcome.meetingId,
                            output_path: outcome.outputPath,
                            segment_count: outcome.segmentCount,
                            transcript_version: outcome.transcriptVersion,
                        },
                    };
                }
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