import { createJobProgressSource } from "../jobs/progress-source.js";
import { ManagedAudioError } from "../audio/managed-audio-error.js";
import { RuntimeAssetsError } from "../assets/runtime-assets-error.js";
import { AssetVerificationError } from "../assets/verify-assets.js";
import { MeetingRepositoryError, } from "../storage/meeting-repository.js";
import { WorkerClientError } from "../worker/worker-client.js";
import { runWorkerPipeline, } from "../worker/worker-pipeline.js";
import { ProgressOutput, workerPercent } from "./meeting-run-progress.js";
class TranscriptionRunCancelled extends Error {
}
function failureCode(error, cancelled) {
    if (cancelled || error instanceof TranscriptionRunCancelled)
        return "CANCELLED_BY_USER";
    if (error instanceof ManagedAudioError)
        return error.code;
    if (error instanceof RuntimeAssetsError || error instanceof AssetVerificationError) {
        return "MODEL_NOT_READY";
    }
    if (error instanceof MeetingRepositoryError) {
        return error.code === "STORAGE_FAILURE" ? error.code : "ENGINE_FAILURE";
    }
    if (error instanceof WorkerClientError) {
        if (error.code === "WORKER_PROTOCOL_ERROR")
            return error.code;
        if (["ASSET_MISMATCH", "MODEL_LOAD_FAILED", "NATIVE_LOAD_FAILED"].includes(error.code)) {
            return "MODEL_NOT_READY";
        }
    }
    return "ENGINE_FAILURE";
}
function completedDecision(meeting) {
    return {
        terminalCode: null,
        outcome: {
            status: "completed",
            detail: `meeting_id=${meeting.meetingId} transcript_version=${meeting.transcriptVersion} result_status=${meeting.committedStatus}`,
        },
    };
}
function failedDecision(code) {
    return {
        terminalCode: code,
        outcome: { status: "failed", detail: code },
    };
}
function killedDecision() {
    return {
        terminalCode: "CANCELLED_BY_USER",
        outcome: { status: "killed", detail: "CANCELLED_BY_USER" },
    };
}
function candidateFrom(result, identity, durationMs, engineFingerprint, nowMs) {
    if (result.type === "empty") {
        return {
            meetingId: identity.meetingId,
            runId: identity.runId,
            baseVersion: identity.baseVersion,
            resultStatus: "empty",
            resultReason: result.asr.payload.empty_reason,
            durationMs,
            engineFingerprint,
            segments: [],
            nowMs,
        };
    }
    return {
        meetingId: identity.meetingId,
        runId: identity.runId,
        baseVersion: identity.baseVersion,
        resultStatus: result.diarization.payload.result_status,
        resultReason: result.diarization.payload.result_reason,
        durationMs,
        engineFingerprint,
        segments: result.diarization.payload.segments.map((segment) => ({
            seq: segment.seq,
            startMs: segment.start_ms,
            endMs: segment.end_ms,
            speakerLabel: segment.speaker_label,
            text: segment.text,
        })),
        nowMs,
    };
}
export class MeetingTranscriptionRun {
    identity;
    source;
    dependencies;
    release;
    hooks;
    output;
    controller = new AbortController();
    progress;
    decision = null;
    jobIdValue = null;
    resolveDone;
    constructor(identity, source, dependencies, release) {
        this.identity = identity;
        this.source = source;
        this.dependencies = dependencies;
        this.release = release;
        this.progress = new ProgressOutput(identity.startedAtMs, dependencies.now);
        const done = new Promise((resolve) => { this.resolveDone = resolve; });
        this.output = createJobProgressSource(() => this.progress.read());
        this.hooks = {
            cancel: (reason) => this.cancel(reason),
            done,
        };
    }
    get jobId() {
        return this.jobIdValue;
    }
    claim() {
        if (this.source.kind === "retranscribe") {
            this.dependencies.repository.beginRetranscription({
                meetingId: this.identity.meetingId,
                expectedVersion: this.identity.baseVersion,
                runId: this.identity.runId,
                nowMs: this.identity.startedAtMs,
                ...(this.dependencies.processingIdentity === undefined ? {}
                    : { processingIdentity: this.dependencies.processingIdentity }),
            });
            return;
        }
        const input = this.source.input;
        this.dependencies.repository.createImport({
            meetingId: this.identity.meetingId,
            title: this.identity.title,
            sourceName: input.sourceName,
            sourceFormat: input.sourceFormat,
            sourceSizeBytes: input.sourceSizeBytes,
            runId: this.identity.runId,
            nowMs: this.identity.startedAtMs,
            ...(this.dependencies.processingIdentity === undefined ? {}
                : { processingIdentity: this.dependencies.processingIdentity }),
        });
    }
    publish(jobId) {
        this.jobIdValue = jobId;
        void this.execute();
    }
    async closeUnclaimed() {
        if (this.source.kind === "import")
            await this.source.input.close();
    }
    timestamp() {
        return Math.max(this.identity.startedAtMs, Math.trunc(this.dependencies.now()));
    }
    cancel(reason) {
        if (this.controller.signal.aborted)
            return;
        this.controller.abort(reason ?? "meeting transcription cancelled");
        if (this.decision !== null)
            return;
        try {
            const result = this.dependencies.repository.finishRun({
                meetingId: this.identity.meetingId,
                runId: this.identity.runId,
                baseVersion: this.identity.baseVersion,
                outcome: "cancelled",
                errorCode: "CANCELLED_BY_USER",
                errorStage: this.progress.stage,
                nowMs: this.timestamp(),
            });
            this.decision = result.outcome === "already_committed"
                ? completedDecision(result.meeting)
                : killedDecision();
            if (this.decision.outcome.status === "killed") {
                this.progress.finish(this.progress.stage, "CANCELLED_BY_USER");
            }
        }
        catch {
            // The producer retries the same business fence while settling its failure.
        }
    }
    async execute() {
        try {
            await this.runPipeline();
        }
        catch (error) {
            this.linearizeFailure(error);
        }
        if (this.decision !== null && this.decision.outcome.status !== "completed") {
            this.progress.finish(this.progress.stage, this.decision.terminalCode ?? "ENGINE_FAILURE");
        }
        const cleanupFailed = await this.releaseResources();
        let decision = this.decision ?? failedDecision("ENGINE_FAILURE");
        if (this.decision === null)
            this.progress.finish(this.progress.stage, "ENGINE_FAILURE");
        if (cleanupFailed) {
            decision = this.withCleanupFailure(decision);
        }
        else if (decision.outcome.status === "completed") {
            this.progress.finish("cleaning");
        }
        try {
            this.release(this);
        }
        catch {
            decision = this.withCleanupFailure(decision);
        }
        this.resolveDone(decision.outcome);
    }
    async runPipeline() {
        const audio = await this.prepareAudio();
        if (audio === null)
            return;
        this.progress.update("loading_asr", 25);
        const result = await runWorkerPipeline({
            asr: this.dependencies.asr,
            diarization: this.dependencies.diarization,
            asrRun: {
                type: "run",
                request_id: this.identity.runId,
                kind: "asr",
                base_transcript_version: this.identity.baseVersion,
                payload: { audio_path: audio.audioPath, duration_ms: audio.durationMs },
            },
            diarizationRequestId: `${this.identity.runId}:diar`,
            signal: this.controller.signal,
            onHandoff: () => this.progress.update("loading_diarization", 65),
            onReady: (kind) => this.progress.update(kind === "asr" ? "transcribing" : "diarizing", kind === "asr" ? 30 : 70),
            onProgress: (kind, message) => this.progress.update(kind === "asr" ? "transcribing" : "diarizing", workerPercent(kind, message)),
        });
        this.commit(result, audio.durationMs);
    }
    async prepareAudio() {
        if (this.controller.signal.aborted)
            throw new TranscriptionRunCancelled();
        this.progress.update("validating", 5);
        if (this.source.kind === "retranscribe") {
            this.progress.update("normalizing", 10);
            return this.dependencies.audioStore.prepareRetranscription(this.identity.meetingId, this.source.meeting.sourceFormat, this.source.meeting.origin, this.controller.signal);
        }
        return this.prepareImportedAudio(this.source.input);
    }
    async prepareImportedAudio(input) {
        const source = await input.persist(this.identity.meetingId);
        const recorded = this.dependencies.repository.recordManagedSource({
            meetingId: this.identity.meetingId,
            runId: this.identity.runId,
            sourceSha256: source.sourceSha256,
            nowMs: this.timestamp(),
        });
        if (recorded.outcome !== "updated") {
            this.decision = this.decisionFrom(recorded.meeting);
            return null;
        }
        this.progress.update("normalizing", 10);
        return this.dependencies.audioStore.normalize(this.identity.meetingId, source.sourceFormat, this.controller.signal);
    }
    commit(result, durationMs) {
        this.progress.update("committing", 95);
        const committed = this.dependencies.repository.commitTranscript(candidateFrom(result, this.identity, durationMs, this.dependencies.engineFingerprint, this.timestamp()));
        this.decision = committed.outcome === "committed"
            ? completedDecision(committed.meeting)
            : this.decisionFrom(committed.meeting);
        if (this.decision.outcome.status === "completed")
            this.progress.update("cleaning", 99);
    }
    decisionFrom(meeting) {
        if (meeting.committedStatus !== null
            && meeting.transcriptVersion > this.identity.baseVersion) {
            return completedDecision(meeting);
        }
        if (meeting.status === "cancelled")
            return killedDecision();
        return failedDecision(meeting.errorCode ?? "ENGINE_FAILURE");
    }
    linearizeFailure(error) {
        if (this.decision !== null)
            return;
        const cancelled = this.controller.signal.aborted || error instanceof TranscriptionRunCancelled;
        const code = failureCode(error, cancelled);
        try {
            const result = this.dependencies.repository.finishRun({
                meetingId: this.identity.meetingId,
                runId: this.identity.runId,
                baseVersion: this.identity.baseVersion,
                outcome: cancelled ? "cancelled" : "failed",
                errorCode: code,
                errorStage: this.progress.stage,
                nowMs: this.timestamp(),
            });
            this.decision = result.outcome === "already_committed"
                ? completedDecision(result.meeting)
                : cancelled ? killedDecision() : failedDecision(code);
        }
        catch (finishError) {
            this.decision = failedDecision(failureCode(finishError, false));
        }
        if (this.decision.outcome.status !== "completed") {
            this.progress.finish(this.progress.stage, this.decision.terminalCode ?? "ENGINE_FAILURE");
        }
    }
    async releaseResources() {
        let failed = false;
        try {
            await this.dependencies.audioStore.cleanupWork(this.identity.meetingId);
        }
        catch {
            failed = true;
        }
        if (this.source.kind === "import") {
            try {
                await this.source.input.close();
            }
            catch {
                failed = true;
            }
        }
        return failed;
    }
    withCleanupFailure(decision) {
        if (decision.outcome.status === "completed") {
            this.progress.finish("cleaning", "STORAGE_FAILURE");
        }
        return {
            ...decision,
            outcome: {
                ...decision.outcome,
                detail: `${decision.outcome.detail ?? decision.outcome.status} cleanup_error=STORAGE_FAILURE`,
            },
        };
    }
}
//# sourceMappingURL=meeting-transcription-run.js.map