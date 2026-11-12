import { join } from "node:path";
import { ManagedAudioError } from "../audio/managed-audio-error.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function assertMeetingId(meetingId) {
    if (!UUID_PATTERN.test(meetingId)) {
        throw new ManagedAudioError("INVALID_PATH", "Meeting id cannot form a managed path");
    }
}
export function managedPaths(root, meetingId, format) {
    assertMeetingId(meetingId);
    const meetingDirectory = join(root, "meetings", meetingId);
    const workDirectory = join(root, "work", meetingId);
    return {
        audioPath: join(meetingDirectory, "audio.wav"),
        audioTemporaryPath: join(workDirectory, "audio.tmp.wav"),
        meetingDirectory,
        workDirectory,
        sourcePath: join(meetingDirectory, `source.${format}`),
        sourceTemporaryPath: join(workDirectory, "source.tmp"),
    };
}
export function recordingAudioLayout(root, meetingId) {
    assertMeetingId(meetingId);
    const meetingDirectory = join(root, "meetings", meetingId);
    return {
        meetingDirectory,
        recordingDirectory: join(meetingDirectory, "recording"),
        workRecordingDirectory: join(root, "work", meetingId, "recording"),
    };
}
export function managedSourcePath(paths, origin) {
    return origin === "recording" ? paths.audioPath : paths.sourcePath;
}
//# sourceMappingURL=managed-audio-paths.js.map