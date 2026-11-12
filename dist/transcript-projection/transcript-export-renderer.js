function quoted(value) {
    return JSON.stringify(value).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
function isoTimestamp(epochMs) {
    return new Date(epochMs).toISOString();
}
function metadata(snapshot, exportedAtMs) {
    const { meeting } = snapshot;
    const values = [
        ["title", meeting.title],
        ["meeting_id", meeting.meetingId],
        ["transcript_version", meeting.transcriptVersion],
        ...(meeting.recordingStartedAtMs === null
            ? [] : [["recording_started_at", isoTimestamp(meeting.recordingStartedAtMs)]]),
        ...(meeting.recordingEndedAtMs === null
            ? [] : [["recording_ended_at", isoTimestamp(meeting.recordingEndedAtMs)]]),
        ["duration_ms", meeting.durationMs],
        ["exported_at", isoTimestamp(exportedAtMs)],
    ];
    return values.map(([key, value]) => `${key}: ${typeof value === "string" ? quoted(value) : value}`)
        .join("\n");
}
function timestamp(milliseconds, decimal) {
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor(milliseconds / 60_000) % 60;
    const seconds = Math.floor(milliseconds / 1_000) % 60;
    const millis = milliseconds % 1_000;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":")
        + decimal + String(millis).padStart(3, "0");
}
function timeRange(segment, decimal) {
    return `${timestamp(segment.startMs, decimal)} --> ${timestamp(segment.endMs, decimal)}`;
}
function markdownSegment(segment, options) {
    const facts = [
        ...(options.includeTimestamps ? [`time: ${timeRange(segment, ".")}`] : []),
        ...(options.includeSpeakers ? [`speaker: ${quoted(segment.speakerLabel)}`] : []),
    ];
    return `## Segment ${segment.seq + 1}\n${facts.length === 0 ? "" : `\n${facts.join("\n")}\n`}\n${segment.text}`;
}
function textSegment(segment, options) {
    const facts = [
        ...(options.includeTimestamps ? [`[${timeRange(segment, ".")}]`] : []),
        ...(options.includeSpeakers ? [`[${segment.speakerLabel}]`] : []),
    ].join(" ");
    return facts === "" ? segment.text : `${facts}\n${segment.text}`;
}
function cue(segment, decimal, includeSpeakers) {
    const speaker = includeSpeakers ? `${segment.speakerLabel}\n` : "";
    return `${timeRange(segment, decimal)}\n${speaker}${segment.text}`;
}
export function renderTranscriptExport(snapshot, options) {
    const source = metadata(snapshot, options.exportedAtMs);
    if (options.format === "md") {
        return `# Meeting transcript\n\n${source}\n\n${snapshot.segments.map((segment) => markdownSegment(segment, options)).join("\n\n")}\n`;
    }
    if (options.format === "txt") {
        return `${source}\n\n---\n\n${snapshot.segments.map((segment) => textSegment(segment, options)).join("\n\n")}\n`;
    }
    if (options.format === "srt") {
        return snapshot.segments.map((segment) => `${segment.seq + 1}\n${cue(segment, ",", options.includeSpeakers)}`).join("\n\n") + "\n";
    }
    return `WEBVTT\n\nNOTE\n${source}\n\n${snapshot.segments.map((segment) => cue(segment, ".", options.includeSpeakers)).join("\n\n")}\n`;
}
//# sourceMappingURL=transcript-export-renderer.js.map