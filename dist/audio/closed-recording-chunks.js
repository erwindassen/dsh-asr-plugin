import { readdir, realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { buildRecordingTimeline, MAX_RECORDING_CHUNKS_PER_TRACK, } from "./recording-timeline.js";
import { openPcm16Wav, PCM_SAMPLE_RATE } from "./wav-reader.js";
const CLOSED_CHUNK_NAME = /^(\d+)-(\d+)\.wav$/;
export class ClosedRecordingChunkError extends Error {
    code = "AUDIO_READ_FAILED";
    constructor(message, options) {
        super(message, options);
        this.name = "ClosedRecordingChunkError";
    }
}
function failure(message, cause) {
    return new ClosedRecordingChunkError(message, cause === undefined ? undefined : { cause });
}
function timestamp(value) {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 0)
        throw failure("Chunk timestamp is invalid");
    return result;
}
function timestampRange(name) {
    const match = CLOSED_CHUNK_NAME.exec(name);
    if (match === null)
        throw failure("Closed chunk filename is invalid");
    const startUs = timestamp(match[1]);
    const endUs = timestamp(match[2]);
    if (endUs <= startUs)
        throw failure("Closed chunk timestamp range is invalid");
    return { startUs, endUs };
}
function expectedFrames(startUs, endUs) {
    return Math.round(((endUs - startUs) * PCM_SAMPLE_RATE) / 1_000_000);
}
function assertInside(root, path) {
    const fromRoot = relative(root, path);
    if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
        throw failure("Closed chunk path escapes the recording root");
    }
}
async function inspectChunk(root, track, path, name) {
    const canonical = await realpath(path);
    assertInside(root, canonical);
    const info = await stat(canonical);
    if (!info.isFile() || info.size < 44)
        throw failure("Closed chunk is not a regular WAV");
    const { startUs, endUs } = timestampRange(name);
    const reader = await openPcm16Wav(canonical);
    try {
        if (Math.abs(reader.metadata.frameCount - expectedFrames(startUs, endUs)) > 1) {
            throw failure("Closed chunk duration does not match its timestamp");
        }
        return {
            id: canonical,
            track,
            startUs,
            endUs,
            frameCount: reader.metadata.frameCount,
            size: info.size,
        };
    }
    finally {
        await reader.close();
    }
}
class FileClosedRecordingChunks {
    recordingRoot;
    trackRoots;
    known = new Map();
    constructor(recordingRoot, trackRoots) {
        this.recordingRoot = recordingRoot;
        this.trackRoots = trackRoots;
    }
    async scan() {
        try {
            const seen = new Set();
            for (const track of ["mic", "system"])
                await this.scanTrack(track, seen);
            for (const id of this.known.keys()) {
                if (!seen.has(id))
                    throw failure("A closed recording chunk disappeared");
            }
            return this.known.size === 0 ? null : buildRecordingTimeline([...this.known.values()]);
        }
        catch (error) {
            if (error instanceof ClosedRecordingChunkError)
                throw error;
            throw failure("Closed recording chunks could not be scanned", error);
        }
    }
    async read(chunk, startFrame, endFrame) {
        const known = this.known.get(chunk.id);
        if (known === undefined || known.frameCount !== chunk.frameCount) {
            throw failure("Closed chunk is not part of the current timeline");
        }
        const reader = await openPcm16Wav(known.id);
        try {
            const info = await stat(known.id);
            if (info.size !== known.size || reader.metadata.frameCount !== known.frameCount) {
                throw failure("Closed chunk changed after it was scanned");
            }
            return await reader.readFrames(startFrame, endFrame);
        }
        catch (error) {
            if (error instanceof ClosedRecordingChunkError)
                throw error;
            throw failure("Closed recording chunk could not be read", error);
        }
        finally {
            await reader.close().catch(() => undefined);
        }
    }
    async scanTrack(track, seen) {
        const root = this.trackRoots[track];
        const entries = await readdir(root, { withFileTypes: true });
        const wav = entries.filter((entry) => entry.name.endsWith(".wav"));
        if (wav.length > MAX_RECORDING_CHUNKS_PER_TRACK) {
            throw failure("Recording track has too many chunks");
        }
        for (const entry of wav) {
            if (!entry.isFile())
                throw failure("Closed chunk must be a regular file");
            const path = await realpath(join(root, entry.name));
            assertInside(this.recordingRoot, path);
            seen.add(path);
            if (!this.known.has(path)) {
                this.known.set(path, await inspectChunk(this.recordingRoot, track, path, entry.name));
            }
        }
    }
}
export async function openClosedRecordingChunks(recordingDirectory) {
    try {
        const recordingRoot = await realpath(recordingDirectory);
        const mic = await realpath(join(recordingRoot, "mic", "chunks"));
        const system = await realpath(join(recordingRoot, "system", "chunks"));
        assertInside(recordingRoot, mic);
        assertInside(recordingRoot, system);
        return new FileClosedRecordingChunks(recordingRoot, { mic, system });
    }
    catch (error) {
        if (error instanceof ClosedRecordingChunkError)
            throw error;
        throw failure("Recording chunk roots are unavailable", error);
    }
}
//# sourceMappingURL=closed-recording-chunks.js.map