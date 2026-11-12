import { decodeProcessingIdentity } from "./processing-identity.js";
function requireInteger(value, name) {
    if (!Number.isSafeInteger(value))
        throw new Error(`Invalid ${name}`);
    return value;
}
function requireString(value, name) {
    if (typeof value !== "string")
        throw new Error(`Invalid ${name}`);
    return value;
}
function nullableString(value, name) {
    return value === null ? null : requireString(value, name);
}
function nullableInteger(value, name) {
    return value === null ? null : requireInteger(value, name);
}
function enumValue(value, values, name) {
    const text = requireString(value, name);
    if (!values.includes(text))
        throw new Error(`Invalid ${name}`);
    return text;
}
export function parseMeetingRow(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Invalid meeting row");
    }
    const row = value;
    return {
        meetingId: requireString(row.meeting_id, "meeting_id"),
        origin: enumValue(row.origin, ["import", "recording"], "origin"),
        title: requireString(row.title, "title"),
        sourceName: requireString(row.source_name, "source_name"),
        sourceFormat: enumValue(row.source_format, ["wav", "m4a", "mp3"], "source_format"),
        sourceSizeBytes: nullableInteger(row.source_size_bytes, "source_size_bytes"),
        sourceSha256: nullableString(row.source_sha256, "source_sha256"),
        durationMs: row.duration_ms === null ? null : requireInteger(row.duration_ms, "duration_ms"),
        status: enumValue(row.status, ["recording", "processing", "completed", "empty", "partial", "failed", "cancelled", "deleting"], "status"),
        committedStatus: row.committed_status === null
            ? null
            : enumValue(row.committed_status, ["completed", "empty", "partial"], "committed_status"),
        transcriptVersion: requireInteger(row.transcript_version, "transcript_version"),
        resultReason: nullableString(row.result_reason, "result_reason"),
        runIdentity: decodeProcessingIdentity(row.run_identity),
        transcriptIdentity: decodeProcessingIdentity(row.transcript_identity),
        engineFingerprint: nullableString(row.engine_fingerprint, "engine_fingerprint"),
        activeRunId: nullableString(row.active_run_id, "active_run_id"),
        runKind: row.run_kind === null
            ? null
            : enumValue(row.run_kind, ["import", "retranscribe", "recording"], "run_kind"),
        errorCode: nullableString(row.error_code, "error_code"),
        errorStage: nullableString(row.error_stage, "error_stage"),
        createdAtMs: requireInteger(row.created_at_ms, "created_at_ms"),
        updatedAtMs: requireInteger(row.updated_at_ms, "updated_at_ms"),
        recordingStartedAtMs: nullableInteger(row.recording_started_at_ms, "recording_started_at_ms"),
        recordingEndedAtMs: nullableInteger(row.recording_ended_at_ms, "recording_ended_at_ms"),
    };
}
export function parseSegmentRow(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Invalid segment row");
    }
    const row = value;
    return {
        seq: requireInteger(row.seq, "seq"),
        startMs: requireInteger(row.start_ms, "start_ms"),
        endMs: requireInteger(row.end_ms, "end_ms"),
        speakerLabel: requireString(row.speaker_label, "speaker_label"),
        text: requireString(row.text, "text"),
    };
}
//# sourceMappingURL=row-mappers.js.map