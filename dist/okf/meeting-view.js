import { OkfError } from "./contracts.js";
function meetingStartMs(meeting) {
    return meeting.recordingStartedAtMs ?? meeting.createdAtMs;
}
function meetingDurationMs(meeting, segments) {
    if (meeting.durationMs !== null)
        return meeting.durationMs;
    return segments.reduce((longest, segment) => Math.max(longest, segment.endMs), 0);
}
/**
 * Distinct speaker labels in first-appearance order. Labels come from
 * diarization and may be empty; empty labels are dropped rather than merged.
 */
function speakerLabels(segments) {
    const seen = new Set();
    const names = [];
    for (const segment of segments) {
        const name = segment.speaker.trim();
        if (name === "" || seen.has(name))
            continue;
        seen.add(name);
        names.push(name);
    }
    return names;
}
/**
 * Reads one committed transcript version and freezes it into the bundle view.
 * The view is a plain value so ingestion never re-reads a moving transcript.
 */
export function buildOkfMeetingView(source, meetingId, speakerNames = {}) {
    const meeting = source.getMeeting(meetingId);
    if (meeting === null) {
        throw new OkfError("OKF_NO_TRANSCRIPT", `Meeting ${meetingId} does not exist`);
    }
    if (meeting.committedStatus === null || meeting.transcriptVersion === 0) {
        throw new OkfError("OKF_NO_TRANSCRIPT", `Meeting ${meetingId} has no committed transcript`);
    }
    const snapshot = source.getCommittedTranscriptSnapshot(meetingId);
    const segments = snapshot.segments.map((segment) => ({
        seq: segment.seq,
        speaker: segment.speakerLabel,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
    }));
    if (segments.length === 0) {
        throw new OkfError("OKF_NO_TRANSCRIPT", `Meeting ${meetingId} committed an empty transcript`);
    }
    return {
        meetingId: meeting.meetingId,
        title: meeting.title,
        startedAtMs: meetingStartMs(meeting),
        durationMs: meetingDurationMs(meeting, segments),
        speakers: speakerLabels(segments),
        transcriptVersion: meeting.transcriptVersion,
        committedAtMs: meeting.updatedAtMs,
        partial: meeting.committedStatus === "partial",
        speakerNames,
        segments,
    };
}
//# sourceMappingURL=meeting-view.js.map