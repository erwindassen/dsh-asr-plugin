import { MeetingRepositoryError } from "../storage/errors.js";
export function validateMeetingReferenceLocale(locale) {
    try {
        if (typeof locale !== "string" || locale.length > 100
            || Intl.getCanonicalLocales(locale).length !== 1)
            throw new RangeError();
    }
    catch {
        throw new MeetingRepositoryError("INVALID_INPUT", "Meeting reference locale is invalid");
    }
}
export function isActiveReferencePhase(phase) {
    return phase === "starting" || phase === "recording" || phase === "finalizing";
}
export function meetingReferenceCandidate(meeting, online) {
    const current = online?.meetingId === meeting.meetingId ? online : null;
    const phase = current?.phase ?? meeting.status;
    if (phase === "deleting")
        throw new TypeError("Deleting Meeting cannot be referenced");
    return {
        meetingId: meeting.meetingId,
        label: meeting.title,
        origin: meeting.origin,
        phase,
        startedAtMs: current?.recordingStartedAtMs ?? meeting.recordingStartedAtMs,
        createdAtMs: meeting.createdAtMs,
        recordingElapsedMs: isActiveReferencePhase(phase)
            ? current?.recordingElapsedMs ?? null
            : null,
        durationMs: current?.durationMs ?? meeting.durationMs,
    };
}
//# sourceMappingURL=meeting-reference.js.map