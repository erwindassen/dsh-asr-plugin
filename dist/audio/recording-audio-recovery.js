import { ManagedAudioError } from "./managed-audio-error.js";
import { buildRecordingAudioCandidate, recoverPromotedRecordingAudio, verifyAndPromoteRecordingAudio, } from "./recording-audio-candidate.js";
import { openClosedRecordingChunks } from "./closed-recording-chunks.js";
import { PCM_SAMPLE_RATE } from "./wav-reader.js";
function recoveryFailure(message, cause) {
    return new ManagedAudioError("AUDIO_RECOVERY_FAILED", message, cause === undefined ? undefined : { cause });
}
export async function recoverRecordingAudio(paths, maximumDurationMs) {
    try {
        if (maximumDurationMs !== undefined && (!Number.isFinite(maximumDurationMs) || maximumDurationMs <= 0))
            throw recoveryFailure("Recording recovery duration bound is invalid");
        const promoted = await recoverPromotedRecordingAudio(paths, maximumDurationMs);
        if (promoted !== null)
            return promoted;
        const chunks = await openClosedRecordingChunks(paths.recordingDirectory);
        if (maximumDurationMs !== undefined) {
            const timeline = await chunks.scan();
            if (timeline !== null && timeline.frameCount * 1_000 > maximumDurationMs * PCM_SAMPLE_RATE) {
                throw recoveryFailure("Recording audio exceeds the verified capture duration");
            }
        }
        const candidate = await buildRecordingAudioCandidate(paths, chunks);
        return await verifyAndPromoteRecordingAudio(paths, candidate);
    }
    catch (error) {
        throw recoveryFailure("Recording audio could not be recovered", error);
    }
}
//# sourceMappingURL=recording-audio-recovery.js.map