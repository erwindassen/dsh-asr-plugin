import { constants, createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, open, realpath, rename, rm, stat, } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pcm16Integer } from "./pcm16.js";
import { renderRecordingTrackWindow, renderRecordingWindow, } from "./recording-timeline.js";
import { openPcm16Wav, PCM_SAMPLE_RATE, } from "./wav-reader.js";
const WAV_HEADER_BYTES = 44;
const WRITE_WINDOW_FRAMES = PCM_SAMPLE_RATE * 60;
const CANDIDATE_FILES = ["audio.tmp.wav", "mic.tmp.wav", "system.tmp.wav"];
export class RecordingAudioCandidateError extends Error {
    code = "AUDIO_READ_FAILED";
    constructor(message, options) {
        super(message, options);
        this.name = "RecordingAudioCandidateError";
    }
}
function failure(message, cause) {
    return new RecordingAudioCandidateError(message, cause === undefined ? undefined : { cause });
}
function wavHeader(frameCount) {
    const dataBytes = frameCount * 2;
    const header = Buffer.alloc(WAV_HEADER_BYTES);
    header.write("RIFF", 0, 4, "ascii");
    header.writeUInt32LE(36 + dataBytes, 4);
    header.write("WAVEfmt ", 8, 8, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
    header.writeUInt32LE(PCM_SAMPLE_RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36, 4, "ascii");
    header.writeUInt32LE(dataBytes, 40);
    return header;
}
function encodePcm16(samples) {
    const bytes = Buffer.allocUnsafe(samples.length * 2);
    for (let index = 0; index < samples.length; index += 1) {
        bytes.writeInt16LE(pcm16Integer(samples[index]), index * 2);
    }
    return bytes;
}
async function writeAll(handle, bytes, position) {
    let offset = 0;
    while (offset < bytes.byteLength) {
        const result = await handle.write(bytes, offset, bytes.byteLength - offset, position + offset);
        if (result.bytesWritten === 0)
            throw failure("Recording candidate write made no progress");
        offset += result.bytesWritten;
    }
}
async function writeCandidate(path, timeline, render) {
    await rm(path, { force: true });
    const handle = await open(path, "wx", 0o600);
    try {
        await writeAll(handle, wavHeader(timeline.frameCount), 0);
        for (let start = 0; start < timeline.frameCount; start += WRITE_WINDOW_FRAMES) {
            const end = Math.min(timeline.frameCount, start + WRITE_WINDOW_FRAMES);
            await writeAll(handle, encodePcm16(await render(start, end)), WAV_HEADER_BYTES + start * 2);
        }
        await handle.sync();
    }
    catch (error) {
        await rm(path, { force: true }).catch(() => undefined);
        throw error;
    }
    finally {
        await handle.close().catch(() => undefined);
    }
}
function throwIfAborted(signal) {
    if (signal?.aborted === true)
        throw failure("Recording audio candidate promotion was cancelled");
}
async function fileSha256(path, signal) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) {
        throwIfAborted(signal);
        hash.update(chunk);
    }
    return hash.digest("hex");
}
async function syncDirectory(directory) {
    const handle = await open(directory, constants.O_RDONLY);
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
async function cloneSingleTrack(source, destination) {
    await rm(destination, { force: true });
    await copyFile(source, destination, constants.COPYFILE_FICLONE);
    await chmod(destination, 0o600);
    const handle = await open(destination, "r+");
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
}
function candidateFiles(tracks) {
    return [
        "audio.tmp.wav",
        ...tracks.map((track) => `${track}.tmp.wav`),
    ];
}
async function cleanCandidates(directory) {
    await Promise.all(CANDIDATE_FILES.map((name) => rm(join(directory, name), { force: true })));
}
async function removeCoveredChunks(recordingDirectory, tracks) {
    await Promise.all(tracks.map(async (track) => rm(join(recordingDirectory, track), { force: true, recursive: true })));
    await syncDirectory(recordingDirectory);
}
export async function buildRecordingAudioCandidate(paths, chunks) {
    try {
        const timeline = await chunks.scan();
        if (timeline === null)
            throw failure("Recording has no closed chunks");
        await mkdir(paths.workRecordingDirectory, { recursive: true, mode: 0o700 });
        await chmod(paths.workRecordingDirectory, 0o700);
        await cleanCandidates(paths.workRecordingDirectory);
        const tracks = ["mic", "system"].filter((track) => timeline.chunks.some((chunk) => chunk.track === track));
        for (const track of tracks) {
            await writeCandidate(join(paths.workRecordingDirectory, `${track}.tmp.wav`), timeline, (start, end) => renderRecordingTrackWindow(timeline, track, start, end, (chunk, from, to) => chunks.read(chunk, from, to)));
        }
        const audioPath = join(paths.workRecordingDirectory, "audio.tmp.wav");
        if (tracks.length === 1) {
            await cloneSingleTrack(join(paths.workRecordingDirectory, `${tracks[0]}.tmp.wav`), audioPath);
        }
        else {
            await writeCandidate(audioPath, timeline, (start, end) => renderRecordingWindow(timeline, start, end, (chunk, from, to) => chunks.read(chunk, from, to)));
        }
        const sourceSizeBytes = (await stat(audioPath)).size;
        return {
            audioFiles: candidateFiles(tracks),
            captureEndUs: Math.max(...timeline.chunks.map((chunk) => chunk.endUs)),
            durationMs: Math.ceil((timeline.frameCount * 1_000) / PCM_SAMPLE_RATE),
            frameCount: timeline.frameCount,
            sourceSha256: await fileSha256(audioPath),
            sourceSizeBytes,
            tracks,
        };
    }
    catch (error) {
        if (error instanceof RecordingAudioCandidateError)
            throw error;
        throw failure("Recording audio candidate could not be built", error);
    }
}
function assertClaim(claim) {
    const files = [...claim.audioFiles];
    if (!Number.isSafeInteger(claim.durationMs) || claim.durationMs < 0 ||
        !Number.isSafeInteger(claim.sourceSizeBytes) || claim.sourceSizeBytes < WAV_HEADER_BYTES ||
        !/^[0-9a-f]{64}$/.test(claim.sourceSha256) ||
        files.length < 1 || files.length > CANDIDATE_FILES.length ||
        files[0] !== "audio.tmp.wav" || new Set(files).size !== files.length ||
        files.some((file) => !CANDIDATE_FILES.includes(file)))
        throw failure("Recording audio candidate claim is invalid");
}
async function inspectFile(directory, name) {
    const canonicalDirectory = await realpath(directory);
    const path = join(canonicalDirectory, name);
    const info = await lstat(path);
    if (!info.isFile() || await realpath(path) !== path) {
        throw failure("Recording audio candidate is not a regular owned file");
    }
    const reader = await openPcm16Wav(path);
    try {
        return { canonical: path, frameCount: reader.metadata.frameCount, size: info.size };
    }
    finally {
        await reader.close();
    }
}
async function pathExists(path) {
    try {
        await lstat(path);
        return true;
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT")
            return false;
        throw error;
    }
}
export async function recoverPromotedRecordingAudio(paths, maximumDurationMs) {
    const sourcePath = join(paths.meetingDirectory, "audio.wav");
    if (!await pathExists(sourcePath))
        return null;
    const tracks = [];
    for (const track of ["mic", "system"]) {
        if (await pathExists(join(paths.recordingDirectory, `${track}.wav`)))
            tracks.push(track);
    }
    if (tracks.length === 0)
        return null;
    const inspected = await Promise.all([
        inspectFile(paths.meetingDirectory, "audio.wav"),
        ...tracks.map((track) => inspectFile(paths.recordingDirectory, `${track}.wav`)),
    ]);
    const audio = inspected[0];
    if (inspected.some((file) => file.frameCount !== audio.frameCount)) {
        throw failure("Promoted recording audio frame counts do not match");
    }
    if (maximumDurationMs !== undefined && audio.frameCount * 1_000 > maximumDurationMs * PCM_SAMPLE_RATE) {
        throw failure("Promoted recording audio exceeds the verified capture duration");
    }
    const recovered = {
        durationMs: Math.ceil((audio.frameCount * 1_000) / PCM_SAMPLE_RATE),
        frameCount: audio.frameCount,
        sourceFormat: "wav",
        sourcePath,
        sourceSha256: await fileSha256(sourcePath),
        sourceSizeBytes: audio.size,
        tracks,
    };
    await removeCoveredChunks(paths.recordingDirectory, tracks);
    return recovered;
}
export async function verifyAndPromoteRecordingAudio(paths, claim, signal) {
    try {
        throwIfAborted(signal);
        assertClaim(claim);
        const inspected = await Promise.all(claim.audioFiles.map((name) => inspectFile(paths.workRecordingDirectory, name)));
        const audio = inspected[0];
        if (audio.size !== claim.sourceSizeBytes ||
            Math.ceil((audio.frameCount * 1_000) / PCM_SAMPLE_RATE) !== claim.durationMs ||
            inspected.some((file) => file.frameCount !== audio.frameCount) ||
            await fileSha256(audio.canonical, signal) !== claim.sourceSha256)
            throw failure("Recording audio candidate does not match its claim");
        const tracks = claim.audioFiles.slice(1).map((name) => name === "mic.tmp.wav" ? "mic" : "system");
        throwIfAborted(signal);
        for (const [index, track] of tracks.entries()) {
            await rename(inspected[index + 1].canonical, join(paths.recordingDirectory, `${track}.wav`));
        }
        const sourcePath = join(paths.meetingDirectory, "audio.wav");
        await rename(audio.canonical, sourcePath);
        await syncDirectory(paths.recordingDirectory);
        await syncDirectory(paths.meetingDirectory);
        await removeCoveredChunks(paths.recordingDirectory, tracks);
        return {
            durationMs: claim.durationMs,
            frameCount: audio.frameCount,
            sourceFormat: "wav",
            sourcePath,
            sourceSha256: claim.sourceSha256,
            sourceSizeBytes: claim.sourceSizeBytes,
            tracks,
        };
    }
    catch (error) {
        if (error instanceof RecordingAudioCandidateError)
            throw error;
        throw failure("Recording audio candidate could not be verified and promoted", error);
    }
}
//# sourceMappingURL=recording-audio-candidate.js.map