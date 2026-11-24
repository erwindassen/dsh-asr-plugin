import { runBoundedVad } from "../asr/bounded-vad.js";
import { runFunAsrDraftWithLoadedRuntime, } from "../asr/funasr/pipeline.js";
import { PCM_SAMPLE_RATE } from "../audio/wav-reader.js";
import { stageWorkerFailure } from "../worker/worker-errors.js";
import { MIN_EMBEDDING_MS } from "../diarization/meeting-diarizer.js";
function assertRange(startFrame, endFrame, frameCount) {
    if (!Number.isSafeInteger(startFrame) ||
        !Number.isSafeInteger(endFrame) ||
        startFrame < 0 ||
        endFrame < startFrame ||
        endFrame > frameCount)
        throw new TypeError("Draft PCM range is invalid");
}
function samplesReader(samples) {
    const frameCount = samples.length;
    return {
        metadata: {
            bitDepth: 16,
            channels: 1,
            dataByteLength: frameCount * 2,
            dataOffset: 44,
            durationMs: Math.ceil((frameCount * 1_000) / PCM_SAMPLE_RATE),
            frameCount,
            sampleRate: PCM_SAMPLE_RATE,
        },
        async close() { },
        async readFrames(startFrame, endFrame) {
            assertRange(startFrame, endFrame, frameCount);
            return samples.slice(startFrame, endFrame);
        },
        async readFramesInto(startFrame, endFrame, target, targetOffset = 0) {
            assertRange(startFrame, endFrame, frameCount);
            if (!(target instanceof Float32Array) ||
                !Number.isSafeInteger(targetOffset) ||
                targetOffset < 0 ||
                targetOffset + endFrame - startFrame > target.length)
                throw new TypeError("Draft PCM target range is invalid");
            target.set(samples.subarray(startFrame, endFrame), targetOffset);
        },
    };
}
function regionFrames(region) {
    return {
        startFrame: Math.floor((region.startMs * PCM_SAMPLE_RATE) / 1_000),
        endFrame: Math.ceil((region.endMs * PCM_SAMPLE_RATE) / 1_000),
    };
}
/** Assigns each recognized unit the live speaker label of the region it falls in. */
function labelUnits(units, regions) {
    if (regions.length === 0)
        return [...units];
    return units.map((unit) => {
        let best = null;
        let bestOverlap = 0;
        for (const region of regions) {
            const overlap = Math.min(unit.endMs, region.endMs) - Math.max(unit.startMs, region.startMs);
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                best = region.label;
            }
        }
        return { ...unit, speakerLabel: best };
    });
}
export function createRecordingDraftRecognizer(vad, asr, speaker) {
    return async (samples) => {
        const reader = samplesReader(samples);
        let regions;
        try {
            regions = await runBoundedVad(reader, vad);
        }
        catch (error) {
            throw stageWorkerFailure(error, "asr", "vad");
        }
        try {
            const result = await runFunAsrDraftWithLoadedRuntime(reader, regions.asrChunks, asr);
            if (speaker === undefined)
                return result.units.map(unit => ({ ...unit, speakerLabel: null }));
            const labeled = [];
            for (const chunk of regions.asrChunks) {
                const label = chunk.endMs - chunk.startMs < MIN_EMBEDDING_MS ? null
                    : await speaker.label(await reader.readFrames(...Object.values(regionFrames(chunk))));
                labeled.push({ endMs: chunk.endMs, label, startMs: chunk.startMs });
            }
            return labelUnits(result.units.map(unit => ({ ...unit, speakerLabel: null })), labeled);
        }
        catch (error) {
            throw stageWorkerFailure(error, "asr", "asr");
        }
    };
}
//# sourceMappingURL=draft-recognizer.js.map