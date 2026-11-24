import { stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { TranscriptProjectionError } from "../transcript-projection/transcript-export-error.js";
import { PickerError } from "./directory-picker.js";
import { transcriptExportFileName } from "./export-filename.js";
import { assignedSpeakerNames, speakerNameProblems, } from "./speaker-attribution.js";
/**
 * Rejects a name map before any directory resolution or write. Only assigned
 * names travel onward, so an identity map exports exactly the labels.
 */
function validatedSpeakerNames(source, request) {
    if (request.speakerNames === undefined)
        return undefined;
    const labels = Object.keys(request.speakerNames).length === 0
        ? []
        : source.getCommittedSpeakerLabels(request.meetingId);
    const problems = speakerNameProblems(labels, request.speakerNames);
    const unknown = problems.find((problem) => problem.kind === "unknown-label");
    if (unknown !== undefined) {
        throw new TranscriptProjectionError("EXPORT_SPEAKER_UNKNOWN", `Unknown speaker label: ${unknown.label}`);
    }
    const invalid = problems.find((problem) => problem.kind === "invalid-name");
    if (invalid !== undefined) {
        throw new TranscriptProjectionError("EXPORT_SPEAKER_INVALID", `Speaker name for label "${invalid.label}" is not in canonical form`);
    }
    const duplicate = problems.find((problem) => problem.kind === "duplicate-name");
    if (duplicate !== undefined) {
        throw new TranscriptProjectionError("EXPORT_SPEAKER_DUPLICATE", `Speaker name "${duplicate.name}" is assigned to more than one label`);
    }
    return assignedSpeakerNames(labels, request.speakerNames);
}
async function requireDirectory(path) {
    if (path.trim() === "") {
        throw new TranscriptProjectionError("EXPORT_DIRECTORY_REQUIRED", "Choose a transcript folder first");
    }
    if (!isAbsolute(path)) {
        throw new TranscriptProjectionError("EXPORT_DIRECTORY_INVALID", "Transcript folder must be an absolute path");
    }
    const info = await stat(path).catch(() => null);
    if (info === null || !info.isDirectory()) {
        throw new TranscriptProjectionError("EXPORT_DIRECTORY_INVALID", "Transcript folder does not exist");
    }
    return path;
}
export function createTranscriptExportControl(options) {
    const chooseDirectory = async (signal) => {
        try {
            return await options.picker.choose({ prompt: options.pickerPrompt(), ...(signal === undefined ? {} : { signal }) });
        }
        catch (error) {
            if (error instanceof PickerError) {
                if (error.kind === "cancelled") {
                    throw new TranscriptProjectionError("CANCELLED_BY_USER", "Folder selection was cancelled");
                }
                throw new TranscriptProjectionError("EXPORT_PICKER_FAILED", "Transcript folder picker failed", { cause: error });
            }
            throw error;
        }
    };
    return {
        chooseDirectory,
        async exportTranscript(request, signal) {
            const meeting = options.meeting.getMeetingRecord(request.meetingId);
            const speakerNames = validatedSpeakerNames(options.meeting, request);
            let directory;
            if (request.directory !== undefined) {
                directory = request.directory;
            }
            else if (request.destination === "choose") {
                const chosen = await chooseDirectory(signal);
                if (chosen === null)
                    throw new TranscriptProjectionError("CANCELLED_BY_USER", "Transcript export was cancelled");
                directory = chosen;
            }
            else {
                directory = options.directory();
            }
            const folder = await requireDirectory(directory);
            const outputPath = join(folder, transcriptExportFileName({
                createdAtMs: meeting.createdAtMs,
                meetingId: meeting.meetingId,
                recordingStartedAtMs: meeting.recordingStartedAtMs,
                title: meeting.title,
            }, request.format));
            const receipt = await options.meeting.exportTranscript({
                format: request.format,
                includeSpeakers: request.includeSpeakers,
                includeTimestamps: request.includeTimestamps,
                meetingId: request.meetingId,
                outputPath,
                overwrite: true,
                ...(speakerNames === undefined ? {} : { speakerNames }),
                ...(signal === undefined ? {} : { signal }),
            });
            return {
                bytes: receipt.bytes,
                format: receipt.format,
                meetingId: receipt.meetingId,
                outputPath: receipt.outputPath,
                segmentCount: receipt.segmentCount,
                transcriptVersion: receipt.transcriptVersion,
            };
        },
    };
}
//# sourceMappingURL=transcript-export-control.js.map