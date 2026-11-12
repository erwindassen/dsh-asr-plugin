import { createJobProgressSource } from "../jobs/progress-source.js";
import { RECORDING_FINALIZATION_DEADLINE_MS, finalizeRecordingRun, waitForRecordingFinalization, } from "../application/recording-finalization.js";
const DRAFT_STALE_MS = 10_000;
function deferred() {
    let settled = false;
    let rejectPromise;
    let resolvePromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return {
        promise,
        reject(error) {
            if (!settled) {
                settled = true;
                rejectPromise(error);
            }
        },
        resolve(value) {
            if (!settled) {
                settled = true;
                resolvePromise(value);
            }
        },
    };
}
export class RecordingSessionError extends Error {
    code;
    constructor(code, options) {
        super("Recording session failed", options);
        this.code = code;
        this.name = "RecordingSessionError";
    }
}
function errorCode(error) {
    if (typeof error === "object" && error !== null && "code" in error &&
        typeof error.code === "string" && error.code.length > 0 && error.code.length <= 100) {
        return error.code;
    }
    return "ENGINE_FAILURE";
}
function trackView(track) {
    return {
        requested: track.requested,
        state: track.state === "starting" ? "off" : track.state,
        errorCode: track.errorCode,
    };
}
function emptyDraft() {
    return { revision: 0, audioThroughMs: 0, generatedAtMs: 0, segments: [] };
}
function resultPhase(meeting) {
    if (meeting.status === "completed" || meeting.status === "empty" || meeting.status === "partial") {
        return meeting.status;
    }
    return meeting.status === "cancelled" ? "cancelled" : "failed";
}
function outcomeFor(meeting) {
    if (meeting.transcriptVersion > 0 && meeting.committedStatus !== null) {
        return {
            status: "completed",
            detail: `meeting_id=${meeting.meetingId} transcript_version=${meeting.transcriptVersion} result_status=${meeting.committedStatus}`,
        };
    }
    if (meeting.status === "cancelled") {
        return { status: "killed", detail: meeting.errorCode ?? "CANCELLED_BY_USER" };
    }
    return { status: "failed", detail: meeting.errorCode ?? "ENGINE_FAILURE" };
}
export class RecordingSession {
    identity;
    dependencies;
    release;
    hooks;
    output;
    meetingId;
    runId;
    started;
    abort = new AbortController();
    startedState = deferred();
    doneState = deferred();
    cancelRequested = false;
    commandTail = Promise.resolve();
    finalizationMs = null;
    helperSession = null;
    initialization = null;
    jobIdValue = null;
    phase = "starting";
    recordingEndedAtMs = null;
    recordingStartedAtMs = null;
    durationMs = null;
    settlement = null;
    terminalErrorCode = null;
    transcriptVersion = null;
    resultStatus = null;
    workerFailure = null;
    workerLayout = null;
    workerRestarted = false;
    workerSession = null;
    constructor(identity, dependencies, release) {
        this.identity = identity;
        this.dependencies = dependencies;
        this.release = release;
        this.meetingId = identity.meetingId;
        this.runId = identity.runId;
        this.started = this.startedState.promise;
        void this.started.catch(() => undefined);
        this.output = createJobProgressSource(() => JSON.stringify(this.contentFreeView()));
        this.hooks = {
            cancel: () => { this.cancel(); },
            done: this.doneState.promise,
        };
    }
    get jobId() {
        return this.jobIdValue;
    }
    claim() {
        const meeting = this.dependencies.repository.createRecording({
            meetingId: this.identity.meetingId,
            runId: this.identity.runId,
            title: this.identity.title,
            nowMs: this.identity.requestWallClockMs,
            ...(this.dependencies.processingIdentity === undefined ? {}
                : { processingIdentity: this.dependencies.processingIdentity }),
        });
        this.adoptRecordingFacts(meeting);
    }
    publish(jobId) {
        if (this.jobIdValue !== null)
            throw new RecordingSessionError("INVALID_MEETING_STATE");
        this.jobIdValue = jobId;
        this.initialization = this.initialize();
        void this.initialization.catch(() => undefined);
    }
    snapshot() {
        return this.workerSession?.snapshot() ?? emptyDraft();
    }
    view() {
        const draft = this.snapshot();
        const helper = this.helperSession?.snapshot();
        const fallback = {
            requested: true,
            state: "starting",
            errorCode: null,
        };
        const latestAudioAtMs = helper === undefined || helper.captureEndUs === 0
            ? null
            : Math.floor(helper.captureEndUs / 1_000);
        const latestDraftAtMs = draft.generatedAtMs === 0 ? null : draft.generatedAtMs;
        const generatedAtMs = latestDraftAtMs
            ?? this.recordingStartedAtMs
            ?? this.identity.requestWallClockMs;
        return {
            meetingId: this.identity.meetingId,
            jobId: this.jobIdValue ?? "",
            phase: this.phase,
            mic: trackView(helper?.mic ?? fallback),
            system: trackView(helper?.system ?? fallback),
            recordingStartedAtMs: this.recordingStartedAtMs,
            recordingEndedAtMs: this.recordingEndedAtMs,
            recordingElapsedMs: this.recordingElapsed(),
            durationMs: this.durationMs,
            draftRevision: draft.revision,
            draftStale: latestAudioAtMs !== null && latestAudioAtMs > generatedAtMs &&
                this.dependencies.now() - generatedAtMs > DRAFT_STALE_MS,
            latestAudioAtMs,
            latestDraftAtMs,
            transcriptVersion: this.transcriptVersion,
            resultStatus: this.resultStatus,
            finalizationMs: this.finalizationMs,
            errorCode: this.terminalErrorCode,
        };
    }
    setTrack(track, requested) {
        return this.enqueue(async () => {
            if (this.phase !== "recording" || this.helperSession === null) {
                throw new RecordingSessionError("INVALID_MEETING_STATE");
            }
            const current = this.helperSession.snapshot()[track];
            const alreadyTarget = requested
                ? current.requested && (current.state === "on" || current.state === "starting")
                : !current.requested && current.state === "off";
            if (!alreadyTarget)
                await this.helperSession.setTrack(track, requested);
            return this.view();
        });
    }
    stop() {
        return this.enqueue(async () => {
            if (["completed", "empty", "partial", "failed", "cancelled"].includes(this.phase)) {
                return this.view();
            }
            if (this.phase !== "recording" || this.helperSession === null) {
                throw new RecordingSessionError("INVALID_MEETING_STATE");
            }
            this.phase = "finalizing";
            const started = this.monotonicNow();
            const deadlineAtMs = started + RECORDING_FINALIZATION_DEADLINE_MS;
            try {
                const helper = await waitForRecordingFinalization(this.helperSession.stop(), deadlineAtMs, () => this.monotonicNow());
                this.recordingEndedAtMs = Math.max(this.recordingStartedAtMs ?? this.identity.requestWallClockMs, this.anchoredWallClock());
                const worker = await waitForRecordingFinalization(this.finalWorker(), deadlineAtMs, () => this.monotonicNow());
                const committed = await finalizeRecordingRun({
                    identity: {
                        meetingId: this.identity.meetingId,
                        runId: this.identity.runId,
                        baseVersion: this.identity.baseVersion,
                        requestId: this.identity.requestId,
                        captureEndUs: helper.captureEndUs,
                        deadlineAtMs,
                        recordingEndedAtMs: this.recordingEndedAtMs,
                    },
                    dependencies: {
                        audioStore: this.dependencies.audioStore,
                        repository: this.dependencies.repository,
                        worker,
                        engineFingerprint: this.dependencies.engineFingerprint,
                        now: this.dependencies.now,
                        ...(this.dependencies.monotonicNow === undefined
                            ? {}
                            : { monotonicNow: this.dependencies.monotonicNow }),
                    },
                });
                const meeting = committed.meeting;
                this.adoptTerminal(meeting);
                this.finalizationMs = meeting.transcriptVersion > this.identity.baseVersion
                    ? Math.max(0, Math.round(this.monotonicNow() - started))
                    : null;
                await this.settle(outcomeFor(meeting), false);
                return this.view();
            }
            catch (error) {
                return this.failStop(error);
            }
        });
    }
    async failStop(error) {
        let meeting = this.dependencies.repository.getMeeting(this.identity.meetingId);
        if (meeting !== null && meeting.activeRunId !== null) {
            meeting = this.linearizeFailure(error);
        }
        if (meeting === null) {
            this.phase = "failed";
            this.terminalErrorCode = errorCode(error);
        }
        else {
            this.adoptTerminal(meeting);
        }
        await this.settle(meeting === null ? { status: "failed", detail: errorCode(error) }
            : outcomeFor(meeting), true);
        throw error instanceof RecordingSessionError
            ? error
            : new RecordingSessionError(errorCode(error), { cause: error });
    }
    async initialize() {
        try {
            const layout = await this.dependencies.audioStore.prepareRecording(this.identity.meetingId);
            const [helper] = await Promise.all([
                this.startHelper(layout),
                this.startWorker(layout),
            ]);
            if (this.abort.signal.aborted)
                throw new RecordingSessionError("CANCELLED_BY_USER");
            const tracks = helper.snapshot();
            if (tracks.mic.state !== "on" && tracks.system.state !== "on") {
                throw new RecordingSessionError("ALL_REQUESTED_TRACKS_FAILED");
            }
            this.phase = "recording";
            this.startedState.resolve(this.view());
        }
        catch (error) {
            if (!this.abort.signal.aborted)
                this.abort.abort("recording initialization failed");
            this.startedState.reject(error instanceof RecordingSessionError
                ? error
                : new RecordingSessionError(errorCode(error), { cause: error }));
            if (this.settlement !== null)
                return;
            const meeting = this.linearizeFailure(error);
            this.adoptTerminal(meeting);
            await this.settle(outcomeFor(meeting), true);
        }
    }
    cancel() {
        if (this.settlement !== null)
            return;
        this.cancelRequested = true;
        this.abort.abort("recording job cancelled");
        let meeting;
        try {
            meeting = this.dependencies.repository.finishRun({
                meetingId: this.identity.meetingId,
                runId: this.identity.runId,
                baseVersion: this.identity.baseVersion,
                outcome: "cancelled",
                errorCode: "CANCELLED_BY_USER",
                errorStage: this.phase,
                ...(this.recordingEndedAtMs === null
                    ? {}
                    : { recordingEndedAtMs: this.recordingEndedAtMs }),
                nowMs: this.timestamp(),
            }).meeting;
        }
        catch (error) {
            const current = this.dependencies.repository.getMeeting(this.identity.meetingId);
            if (current === null) {
                void this.settle({ status: "failed", detail: errorCode(error) }, true);
                return;
            }
            meeting = current;
        }
        this.adoptTerminal(meeting);
        this.startedState.reject(new RecordingSessionError("CANCELLED_BY_USER"));
        void this.settle(outcomeFor(meeting), meeting.status === "cancelled");
    }
    linearizeFailure(error) {
        const code = errorCode(error);
        try {
            return this.dependencies.repository.finishRun({
                meetingId: this.identity.meetingId,
                runId: this.identity.runId,
                baseVersion: this.identity.baseVersion,
                outcome: this.cancelRequested ? "cancelled" : "failed",
                errorCode: this.cancelRequested ? "CANCELLED_BY_USER" : code,
                errorStage: this.phase,
                ...(this.recordingEndedAtMs === null
                    ? {}
                    : { recordingEndedAtMs: this.recordingEndedAtMs }),
                nowMs: this.timestamp(),
            }).meeting;
        }
        catch {
            const meeting = this.dependencies.repository.getMeeting(this.identity.meetingId);
            if (meeting === null)
                throw error;
            return meeting;
        }
    }
    adoptTerminal(meeting) {
        this.adoptRecordingFacts(meeting);
        this.phase = resultPhase(meeting);
        this.transcriptVersion = meeting.transcriptVersion === 0 ? null : meeting.transcriptVersion;
        this.resultStatus = meeting.committedStatus;
        this.terminalErrorCode = meeting.errorCode;
    }
    settle(outcome, terminate) {
        this.settlement ??= (async () => {
            if (terminate) {
                await Promise.allSettled([
                    this.helperSession?.terminate(),
                    this.workerSession?.terminate(),
                ].filter((operation) => operation !== undefined));
            }
            await this.dependencies.audioStore.cleanupWork(this.identity.meetingId).catch(() => undefined);
            try {
                this.release(this);
            }
            catch {
                outcome = { status: "failed", detail: "ENGINE_FAILURE" };
            }
            this.doneState.resolve(outcome);
        })();
        return this.settlement;
    }
    async startHelper(layout) {
        const session = await this.dependencies.helper.start({
            layout,
            meetingId: this.identity.meetingId,
            signal: this.abort.signal,
        });
        if (this.abort.signal.aborted) {
            await session.terminate();
            throw new RecordingSessionError("CANCELLED_BY_USER");
        }
        this.helperSession = session;
        const snapshot = session.snapshot();
        if ([snapshot.mic, snapshot.system].some((track) => track.requested && track.state === "on")) {
            const meeting = this.dependencies.repository.recordRecordingStarted({
                meetingId: this.identity.meetingId,
                runId: this.identity.runId,
                startedAtMs: this.anchoredWallClock(),
            });
            this.adoptRecordingFacts(meeting);
        }
        this.observeHelper(session);
        return session;
    }
    observeHelper(session) {
        const failed = (error) => {
            void this.handleHelperFailure(session, error).catch(() => undefined);
        };
        void session.completion.then(() => failed(new RecordingSessionError("HELPER_PROCESS_ERROR")), failed);
    }
    handleHelperFailure(session, error) {
        return this.enqueue(async () => {
            if (this.helperSession !== session || this.settlement !== null ||
                !["starting", "recording"].includes(this.phase))
                return;
            if (!this.abort.signal.aborted)
                this.abort.abort("recording helper failed");
            const meeting = this.linearizeFailure(error);
            this.adoptTerminal(meeting);
            this.startedState.reject(error instanceof RecordingSessionError
                ? error
                : new RecordingSessionError(errorCode(error), { cause: error }));
            await this.settle(outcomeFor(meeting), true);
        });
    }
    async startWorker(layout) {
        const session = await this.launchWorker(layout);
        this.installWorker(session, layout);
        return session;
    }
    async launchWorker(layout) {
        const session = await this.dependencies.worker.start({
            layout,
            meetingId: this.identity.meetingId,
            runId: this.identity.runId,
            signal: this.abort.signal,
            onWarning: () => undefined,
        });
        if (this.abort.signal.aborted) {
            await session.terminate();
            throw new RecordingSessionError("CANCELLED_BY_USER");
        }
        return session;
    }
    installWorker(session, layout) {
        this.workerSession = session;
        this.workerLayout = layout;
        this.workerFailure = null;
        this.observeWorker(session);
    }
    observeWorker(session) {
        const failed = (error) => {
            if (this.workerSession !== session ||
                !["starting", "recording"].includes(this.phase))
                return;
            this.workerFailure = error;
            void this.handleWorkerFailure(session, error).catch(() => undefined);
        };
        void session.completion.then(() => failed(new RecordingSessionError("WORKER_PROCESS_ERROR")), failed);
    }
    handleWorkerFailure(session, failure) {
        return this.enqueue(async () => {
            if (this.workerSession !== session || this.settlement !== null ||
                !["starting", "recording"].includes(this.phase))
                return;
            await session.terminate().catch(() => undefined);
            if (this.workerRestarted || this.workerLayout === null) {
                this.workerSession = null;
                this.terminalErrorCode = errorCode(failure);
                return;
            }
            this.workerRestarted = true;
            try {
                const replacement = await this.launchWorker(this.workerLayout);
                if (this.settlement !== null || !["starting", "recording"].includes(this.phase)) {
                    await replacement.terminate().catch(() => undefined);
                    return;
                }
                this.installWorker(replacement, this.workerLayout);
                this.terminalErrorCode = null;
            }
            catch (error) {
                this.workerSession = null;
                this.workerFailure = error;
                this.terminalErrorCode = errorCode(error);
            }
        });
    }
    async finalWorker() {
        if (this.workerSession !== null && this.workerFailure === null)
            return this.workerSession;
        await this.workerSession?.terminate().catch(() => undefined);
        if (this.workerLayout === null)
            throw new RecordingSessionError("WORKER_PROCESS_ERROR");
        const replacement = await this.launchWorker(this.workerLayout);
        if (this.phase !== "finalizing" || this.settlement !== null) {
            await replacement.terminate().catch(() => undefined);
            throw new RecordingSessionError("CANCELLED_BY_USER");
        }
        this.installWorker(replacement, this.workerLayout);
        return replacement;
    }
    enqueue(operation) {
        const next = this.commandTail.then(operation, operation);
        this.commandTail = next.then(() => undefined, () => undefined);
        return next;
    }
    timestamp() {
        return Math.max(this.identity.requestWallClockMs, Math.trunc(this.dependencies.now()));
    }
    anchoredWallClock() {
        const elapsed = Math.max(0, this.monotonicNow() - this.identity.requestMonotonicMs);
        return Math.max(this.identity.requestWallClockMs, Math.trunc(this.identity.requestWallClockMs + elapsed));
    }
    recordingElapsed() {
        if (this.recordingStartedAtMs === null)
            return null;
        if (this.recordingEndedAtMs !== null) {
            return this.recordingEndedAtMs - this.recordingStartedAtMs;
        }
        if (!["starting", "recording", "finalizing"].includes(this.phase))
            return null;
        return Math.max(0, this.anchoredWallClock() - this.recordingStartedAtMs);
    }
    adoptRecordingFacts(meeting) {
        this.recordingStartedAtMs = meeting.recordingStartedAtMs;
        this.recordingEndedAtMs = meeting.recordingEndedAtMs;
        this.durationMs = meeting.committedStatus === null ? null : meeting.durationMs;
    }
    monotonicNow() {
        return this.dependencies.monotonicNow?.() ?? performance.now();
    }
    contentFreeView() {
        const { latestAudioAtMs: _audio, latestDraftAtMs: _draft, ...value } = this.view();
        return value;
    }
}
//# sourceMappingURL=recording-session.js.map