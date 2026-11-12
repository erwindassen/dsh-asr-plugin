import { DraftTranscriptPager, DraftTranscriptPageError, isDraftTranscriptCursor, } from "../recording/draft-transcript-page.js";
import { RecordingSession, RecordingSessionError, } from "../recording/recording-session.js";
import { MeetingRepositoryError, } from "../storage/meeting-repository.js";
const JOB_OUTPUT_LIMIT_BYTES = 4_096;
function title(value, startedAtMs) {
    if (value === undefined)
        return `录音会议 ${new Date(startedAtMs).toISOString()}`;
    const result = value.trim();
    if (result.length < 1 || result.length > 200) {
        throw new RecordingSessionError("INVALID_INPUT");
    }
    return result;
}
export class RecordingApplication {
    dependencies;
    host;
    draftPages;
    lastSession = null;
    constructor(dependencies, host) {
        this.dependencies = dependencies;
        this.host = host;
        this.draftPages = new DraftTranscriptPager(dependencies.now);
    }
    async control(input) {
        if (input.action === "start")
            return this.start(input);
        const session = this.host.activeRecording(input.meetingId);
        if (session === null) {
            if (input.action === "stop" && this.lastSession?.meetingId === input.meetingId) {
                return this.lastSession.view();
            }
            throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Recording session is unavailable");
        }
        // An accepted stop belongs to the recording job, not the requesting connection.
        if (input.action === "stop")
            return session.stop();
        const [track, requested] = input.action.endsWith("_on")
            ? [input.action.startsWith("mic") ? "mic" : "system", true]
            : [input.action.startsWith("mic") ? "mic" : "system", false];
        return session.setTrack(track, requested);
    }
    state() {
        return (this.host.currentRecording() ?? this.lastSession)?.view() ?? null;
    }
    preview() {
        const session = this.host.currentRecording() ?? this.lastSession;
        if (session === null)
            return [];
        return session.snapshot().segments.map((segment) => ({ ...segment }));
    }
    livePage(input) {
        const active = this.host.activeRecording(input.meetingId);
        const meeting = this.dependencies.repository.getMeeting(input.meetingId);
        if (meeting === null)
            throw new MeetingRepositoryError("MEETING_NOT_FOUND", "Meeting does not exist");
        if (meeting.origin !== "recording") {
            throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Meeting is not a recording");
        }
        const retained = meeting.transcriptVersion === 0 &&
            ["failed", "cancelled"].includes(meeting.status) &&
            this.lastSession?.meetingId === input.meetingId
            ? this.lastSession
            : null;
        const source = meeting.committedStatus === null ? active ?? retained : null;
        if (source !== null)
            return this.draftPage(source, input);
        const attached = meeting.committedStatus === null
            ? this.host.draftSource(input.meetingId)
            : null;
        if (attached !== null)
            return this.attachedDraftPage(attached, meeting, input);
        if (input.cursor !== undefined && isDraftTranscriptCursor(input.cursor)) {
            throw new DraftTranscriptPageError("DRAFT_REVISION_CONFLICT", "Draft was committed");
        }
        throw new MeetingRepositoryError("INVALID_MEETING_STATE", "Live draft is unavailable; read the committed transcript with meeting_get");
    }
    clear() {
        this.lastSession = null;
    }
    async admitStart(signal) {
        const controller = new AbortController();
        const admissionSignal = signal === undefined ? controller.signal
            : AbortSignal.any([signal, controller.signal]);
        const preparation = Promise.resolve().then(() => this.dependencies.prepareRuntime?.(admissionSignal, "recording"));
        const permission = Promise.resolve().then(() => this.dependencies.checkPermissions?.(admissionSignal));
        try {
            const [runtime] = await Promise.all([preparation, permission]);
            return runtime;
        }
        catch (error) {
            controller.abort();
            await Promise.allSettled([preparation, permission]);
            throw error;
        }
    }
    async start(input) {
        this.host.requireIdle();
        if (input.signal?.aborted)
            throw new RecordingSessionError("CANCELLED_BY_USER");
        const runtime = await this.admitStart(input.signal);
        this.host.requireIdle();
        if (input.signal?.aborted)
            throw new RecordingSessionError("CANCELLED_BY_USER");
        const requestWallClockMs = Math.max(1, Math.trunc(this.dependencies.now()));
        const requestMonotonicMs = this.dependencies.monotonicNow?.() ?? performance.now();
        const sessionDependencies = {
            audioStore: this.dependencies.audioStore,
            engineFingerprint: runtime?.engineFingerprint ?? this.dependencies.engineFingerprint,
            ...(runtime === undefined ? {} : { processingIdentity: runtime.processingIdentity }),
            helper: this.dependencies.helper,
            now: this.dependencies.now,
            repository: this.dependencies.repository,
            worker: runtime?.recordingWorker ?? this.dependencies.worker,
            ...(this.dependencies.monotonicNow === undefined
                ? {}
                : { monotonicNow: this.dependencies.monotonicNow }),
        };
        const session = new RecordingSession({
            baseVersion: 0,
            meetingId: this.dependencies.generateId(),
            requestMonotonicMs,
            requestWallClockMs,
            runId: this.dependencies.generateId(),
            requestId: this.dependencies.generateId(),
            title: title(input.title, requestWallClockMs),
        }, sessionDependencies, (finished) => {
            this.lastSession = finished;
            this.host.release(finished);
        });
        const jobId = this.dependencies.jobs.start({
            kind: "meeting",
            label: `录音：${session.identity.title}`,
            outputLimitBytes: JOB_OUTPUT_LIMIT_BYTES,
            ...(input.owner === undefined ? {} : { owner: input.owner }),
            output: [session.output],
            run: () => this.host.claim(session),
        });
        session.publish(String(jobId));
        return this.withCancellation(session, input.signal, session.started);
    }
    draftPage(session, input) {
        const page = this.draftPages.page({
            meetingId: input.meetingId,
            snapshot: session.snapshot(),
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            ...(input.limit === undefined ? {} : { limit: input.limit }),
        });
        const view = session.view();
        return {
            meetingId: input.meetingId,
            phase: view.phase,
            recordingStartedAtMs: view.recordingStartedAtMs,
            recordingEndedAtMs: view.recordingEndedAtMs,
            recordingElapsedMs: view.recordingElapsedMs,
            provisional: true,
            revision: page.revision,
            transcriptVersion: null,
            resultStatus: null,
            audioThroughMs: page.audioThroughMs,
            stale: view.draftStale,
            segments: page.segments,
            nextCursor: page.nextCursor,
        };
    }
    attachedDraftPage(source, meeting, input) {
        const page = this.draftPages.page({
            meetingId: input.meetingId,
            snapshot: source.snapshot(),
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            ...(input.limit === undefined ? {} : { limit: input.limit }),
        });
        return {
            meetingId: input.meetingId,
            phase: meeting.status === "recording" ? "recording" : "finalizing",
            recordingStartedAtMs: meeting.recordingStartedAtMs,
            recordingEndedAtMs: meeting.recordingEndedAtMs,
            recordingElapsedMs: meeting.recordingStartedAtMs !== null
                && meeting.recordingEndedAtMs !== null
                ? meeting.recordingEndedAtMs - meeting.recordingStartedAtMs
                : null,
            provisional: true,
            revision: page.revision,
            transcriptVersion: null,
            resultStatus: null,
            audioThroughMs: page.audioThroughMs,
            stale: false,
            segments: page.segments,
            nextCursor: page.nextCursor,
        };
    }
    async withCancellation(session, signal, operation) {
        if (signal === undefined)
            return operation;
        if (signal.aborted) {
            session.hooks.cancel("recording control cancelled");
            throw new RecordingSessionError("CANCELLED_BY_USER");
        }
        let rejectCancellation;
        const cancelled = new Promise((_resolve, reject) => {
            rejectCancellation = reject;
        });
        const onAbort = () => {
            session.hooks.cancel("recording control cancelled");
            rejectCancellation(new RecordingSessionError("CANCELLED_BY_USER"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        try {
            return await Promise.race([operation, cancelled]);
        }
        finally {
            signal.removeEventListener("abort", onAbort);
        }
    }
}
//# sourceMappingURL=recording-application.js.map