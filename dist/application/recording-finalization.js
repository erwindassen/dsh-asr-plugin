export const RECORDING_FINALIZATION_DEADLINE_MS = 30_000;
const COMMIT_RESERVE_MS = 100;
const KNOWN_CODES = new Set([
    "INVALID_REQUEST",
    "ASSET_MISMATCH",
    "AUDIO_READ_FAILED",
    "MODEL_LOAD_FAILED",
    "MODEL_INFERENCE_FAILED",
    "NATIVE_LOAD_FAILED",
    "NATIVE_FAILURE",
    "RESOURCE_LIMIT",
    "WORKER_CANCELLED",
    "WORKER_PROCESS_ERROR",
    "WORKER_PROTOCOL_ERROR",
    "WORKER_TIMEOUT",
    "STORAGE_FAILURE",
]);
export class RecordingFinalizationError extends Error {
    code;
    constructor(code, options) {
        super("Recording finalization failed", options);
        this.code = code;
        this.name = "RecordingFinalizationError";
    }
}
export async function waitForRecordingFinalization(operation, deadlineAtMs, monotonicNow) {
    const remaining = Math.floor(deadlineAtMs - monotonicNow());
    if (!Number.isFinite(remaining) || remaining <= 0) {
        throw new RecordingFinalizationError("WORKER_TIMEOUT");
    }
    let timer;
    try {
        return await Promise.race([
            operation,
            new Promise((_resolve, reject) => {
                timer = setTimeout(() => reject(new RecordingFinalizationError("WORKER_TIMEOUT")), remaining);
            }),
        ]);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
function errorCode(error) {
    if (typeof error === "object" && error !== null && "code" in error) {
        const code = error.code;
        if (typeof code === "string" && KNOWN_CODES.has(code))
            return code;
    }
    return "ENGINE_FAILURE";
}
function errorStage(error) {
    if (typeof error === "object" && error !== null && "stage" in error) {
        const stage = error.stage;
        if (typeof stage === "string" && stage.length > 0 && stage.length <= 100)
            return stage;
    }
    return "finalizing";
}
function timestamp(dependencies) {
    return Math.max(1, Math.trunc(dependencies.now()));
}
function assertResult(result, identity, fingerprint) {
    if (result.request_id !== identity.requestId ||
        result.base_transcript_version !== identity.baseVersion ||
        result.engine_fingerprint !== fingerprint)
        throw new RecordingFinalizationError("WORKER_PROTOCOL_ERROR");
}
function candidate(result) {
    return {
        audioFiles: result.payload.audio_files,
        durationMs: result.payload.duration_ms,
        sourceSha256: result.payload.source_sha256,
        sourceSizeBytes: result.payload.source_size_bytes,
    };
}
function assertPromoted(result, promoted) {
    if (promoted.durationMs !== result.payload.duration_ms ||
        promoted.sourceSizeBytes !== result.payload.source_size_bytes ||
        promoted.sourceSha256 !== result.payload.source_sha256)
        throw new RecordingFinalizationError("AUDIO_READ_FAILED");
}
function commitInput(result, identity, nowMs) {
    return {
        meetingId: identity.meetingId,
        runId: identity.runId,
        baseVersion: identity.baseVersion,
        resultStatus: result.payload.result_status,
        resultReason: result.payload.result_reason,
        durationMs: result.payload.duration_ms,
        sourceSizeBytes: result.payload.source_size_bytes,
        sourceSha256: result.payload.source_sha256,
        engineFingerprint: result.engine_fingerprint,
        segments: result.payload.segments.map((segment) => ({
            seq: segment.seq,
            startMs: segment.start_ms,
            endMs: segment.end_ms,
            speakerLabel: segment.speaker_label,
            text: segment.text,
        })),
        nowMs,
    };
}
function terminalMeeting(repository, identity) {
    const meeting = repository.getMeeting(identity.meetingId);
    if (meeting === null || meeting.activeRunId === identity.runId)
        return null;
    return meeting;
}
async function cleanup(dependencies, meetingId) {
    await dependencies.audioStore.cleanupWork(meetingId).catch(() => undefined);
}
export async function finalizeRecordingRun(input) {
    const { dependencies, identity } = input;
    const monotonicNow = dependencies.monotonicNow ?? performance.now.bind(performance);
    const deadline = identity.deadlineAtMs;
    try {
        dependencies.repository.beginRecordingFinalization({
            meetingId: identity.meetingId,
            runId: identity.runId,
            baseVersion: identity.baseVersion,
            recordingEndedAtMs: identity.recordingEndedAtMs,
            nowMs: timestamp(dependencies),
        });
        const result = await waitForRecordingFinalization(dependencies.worker.finalize({
            type: "finalize",
            request_id: identity.requestId,
            base_transcript_version: identity.baseVersion,
            capture_end_us: identity.captureEndUs,
        }), deadline, monotonicNow);
        assertResult(result, identity, dependencies.engineFingerprint);
        const remaining = Math.floor(deadline - monotonicNow());
        if (remaining <= COMMIT_RESERVE_MS)
            throw new RecordingFinalizationError("WORKER_TIMEOUT");
        const signal = AbortSignal.timeout(remaining - COMMIT_RESERVE_MS);
        const promoted = await dependencies.audioStore.promoteRecordingCandidate(identity.meetingId, candidate(result), signal);
        assertPromoted(result, promoted);
        if (deadline - monotonicNow() <= COMMIT_RESERVE_MS) {
            throw new RecordingFinalizationError("WORKER_TIMEOUT");
        }
        const committed = dependencies.repository.commitTranscript(commitInput(result, identity, timestamp(dependencies)));
        await cleanup(dependencies, identity.meetingId);
        return committed;
    }
    catch (error) {
        const alreadyTerminal = terminalMeeting(dependencies.repository, identity);
        if (alreadyTerminal !== null) {
            await cleanup(dependencies, identity.meetingId);
            return { outcome: "run_not_active", meeting: alreadyTerminal };
        }
        const code = errorCode(error);
        try {
            const finished = dependencies.repository.finishRun({
                meetingId: identity.meetingId,
                runId: identity.runId,
                baseVersion: identity.baseVersion,
                outcome: "failed",
                errorCode: code,
                errorStage: errorStage(error),
                recordingEndedAtMs: identity.recordingEndedAtMs,
                nowMs: timestamp(dependencies),
            });
            if (finished.outcome === "already_committed") {
                await cleanup(dependencies, identity.meetingId);
                return { outcome: "run_not_active", meeting: finished.meeting };
            }
        }
        catch {
            // Preserve the original finalization error; recovery will reconcile an active run.
        }
        await cleanup(dependencies, identity.meetingId);
        throw error instanceof RecordingFinalizationError
            ? error
            : new RecordingFinalizationError(code, { cause: error });
    }
}
//# sourceMappingURL=recording-finalization.js.map