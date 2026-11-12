import { DiarizationError } from "./errors.js";
import { cosineDistance, l2Normalize, normalizedCentroid } from "./vector.js";
import { planEmbeddingWindows } from "./windows.js";
export const MIN_EMBEDDING_MS = 100;
const MIN_CLUSTER_REFERENCE_MS = 1_000;
const MAX_BLOCKS = 20_000;
const MAX_CLUSTER_REFERENCES = 1_024;
const MAX_WARNINGS = 1_000;
const AUTO_CLUSTER_HEIGHT = 1;
const MIN_CLUSTER_SIZE_CAP = 12;
const MIN_CLUSTER_SIZE_RATIO = 10;
const RELAXED_CLUSTER_SIZE_FLOOR = 4;
const RELAXED_CLUSTER_SIZE_RATIO = 14;
const MIN_CLUSTER_SUPPORT_RATIO = 50;
const MAX_CENTROID_DISTANCE = 0.7;
const MAX_TIME_FALLBACK_GAP_MS = 5_000;
function inputFailure(message) {
    throw new DiarizationError("INPUT_INVALID", message);
}
function assertInputs(reader, blocks, regions) {
    if (blocks.length === 0)
        inputFailure("Diarization requires ASR blocks");
    if (blocks.length > MAX_BLOCKS || regions.length > MAX_BLOCKS) {
        throw new DiarizationError("RESOURCE_LIMIT", "Diarization input is too large");
    }
    let previousStart = -1;
    let previousEnd = -1;
    for (const [index, block] of blocks.entries()) {
        if (block.seq !== index ||
            !Number.isSafeInteger(block.startMs) ||
            !Number.isSafeInteger(block.endMs) ||
            block.startMs < 0 ||
            block.endMs < block.startMs ||
            block.endMs > reader.metadata.durationMs ||
            block.startMs < previousStart ||
            (block.startMs === previousStart && block.endMs < previousEnd) ||
            block.text.trim() === "" ||
            block.text.length > 20_000)
            inputFailure("Invalid ASR block for diarization");
        previousStart = block.startMs;
        previousEnd = block.endMs;
    }
    assertRegions(regions, reader.metadata.durationMs);
}
function assertRegions(regions, durationMs) {
    let previousStart = -1;
    for (const region of regions) {
        if (!Number.isSafeInteger(region.startMs) ||
            !Number.isSafeInteger(region.endMs) ||
            region.startMs < 0 ||
            region.endMs <= region.startMs ||
            region.endMs > durationMs ||
            region.startMs < previousStart)
            inputFailure("Invalid VAD region for diarization");
        previousStart = region.startMs;
    }
}
function setWarning(warnings, seq, code) {
    if (!warnings.has(seq))
        warnings.set(seq, { code, seq });
}
function frameRange(reader, window) {
    return [
        Math.floor(window.startMs * 16),
        Math.min(reader.metadata.frameCount, Math.ceil(window.endMs * 16)),
    ];
}
function validateEmbeddingOutput(output) {
    if (!Number.isFinite(output.fbankMs) ||
        !Number.isFinite(output.inferenceMs) ||
        output.fbankMs < 0 ||
        output.inferenceMs < 0) {
        throw new DiarizationError("MODEL_INFERENCE_FAILED", "Speaker embedding metrics are invalid");
    }
    return { ...output, embedding: l2Normalize(output.embedding) };
}
async function extractBlock(reader, block, regions, model, metrics) {
    const embeddings = [];
    let failure;
    for (const window of planEmbeddingWindows(block, regions)) {
        const [start, end] = frameRange(reader, window);
        const samples = await reader.readFrames(start, end);
        metrics.embeddingWindowCount += 1;
        try {
            const output = validateEmbeddingOutput(await model.embed(samples));
            embeddings.push(output.embedding);
            metrics.fbankMs += output.fbankMs;
            metrics.embedMs += output.inferenceMs;
        }
        catch (error) {
            failure = error;
        }
    }
    return { embeddings, failure };
}
async function extractBlocks(reader, blocks, regions, model, warnings, metrics) {
    const extracted = [];
    let attemptedBlocks = 0;
    let lastFailure;
    for (const block of blocks) {
        if (block.endMs - block.startMs < MIN_EMBEDDING_MS) {
            setWarning(warnings, block.seq, "BLOCK_TOO_SHORT");
            extracted.push({ block, embeddings: [], primary: null });
            continue;
        }
        attemptedBlocks += 1;
        const result = await extractBlock(reader, block, regions, model, metrics);
        lastFailure = result.failure ?? lastFailure;
        if (result.embeddings.length === 0)
            setWarning(warnings, block.seq, "EMBEDDING_FAILED");
        else
            metrics.embeddedBlockCount += 1;
        extracted.push({
            block,
            embeddings: result.embeddings,
            primary: result.embeddings.length === 0 ? null : normalizedCentroid(result.embeddings),
        });
    }
    if (attemptedBlocks > 0 && metrics.embeddedBlockCount === 0) {
        throw new DiarizationError("MODEL_INFERENCE_FAILED", "All speaker embeddings failed", {
            cause: lastFailure,
        });
    }
    return extracted;
}
function clusterReferences(extracted) {
    return extracted.flatMap((item, blockIndex) => item.block.endMs - item.block.startMs < MIN_CLUSTER_REFERENCE_MS
        ? []
        : item.embeddings.map((embedding) => ({ blockIndex, embedding })));
}
function selectReferences(references) {
    if (references.length <= MAX_CLUSTER_REFERENCES)
        return [...references];
    return Array.from({ length: MAX_CLUSTER_REFERENCES }, (_, index) => {
        const source = Math.round((index * (references.length - 1)) / (MAX_CLUSTER_REFERENCES - 1));
        return references[source];
    });
}
function assertPartition(clusters, count) {
    const seen = new Set();
    for (const cluster of clusters) {
        if (cluster.length === 0)
            throw new DiarizationError("NATIVE_FAILURE", "Empty speaker cluster");
        for (const index of cluster) {
            if (!Number.isSafeInteger(index) || index < 0 || index >= count || seen.has(index)) {
                throw new DiarizationError("NATIVE_FAILURE", "Invalid speaker cluster partition");
            }
            seen.add(index);
        }
    }
    if (seen.size !== count) {
        throw new DiarizationError("NATIVE_FAILURE", "Incomplete speaker cluster partition");
    }
}
function minimumClusterSize(referenceCount) {
    const standard = Math.min(MIN_CLUSTER_SIZE_CAP, Math.ceil(referenceCount / MIN_CLUSTER_SIZE_RATIO));
    const relaxed = Math.min(MIN_CLUSTER_SIZE_CAP, Math.max(RELAXED_CLUSTER_SIZE_FLOOR, Math.ceil(referenceCount / RELAXED_CLUSTER_SIZE_RATIO)));
    return Math.max(Math.min(standard, relaxed), Math.ceil(referenceCount / MIN_CLUSTER_SUPPORT_RATIO));
}
function createCentroids(references, clusterer) {
    if (references.length === 0)
        return [];
    if (references.length === 1)
        return [references[0].embedding];
    let clusters;
    try {
        clusters = clusterer.cluster(references.map((item) => item.embedding), {
            height: AUTO_CLUSTER_HEIGHT,
        });
    }
    catch (error) {
        throw error instanceof DiarizationError
            ? error
            : new DiarizationError("NATIVE_FAILURE", "Speaker clustering failed", { cause: error });
    }
    assertPartition(clusters, references.length);
    const minimumSize = minimumClusterSize(references.length);
    return clusters
        .filter((cluster) => cluster.length >= minimumSize)
        .sort((left, right) => Math.min(...left.map((index) => references[index].blockIndex)) -
        Math.min(...right.map((index) => references[index].blockIndex)))
        .map((cluster) => normalizedCentroid(cluster.map((index) => references[index].embedding)));
}
function nearestCentroid(embedding, centroids) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [index, centroid] of centroids.entries()) {
        const distance = cosineDistance(embedding, centroid);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    }
    return bestDistance <= MAX_CENTROID_DISTANCE ? bestIndex : null;
}
function intervalGap(first, second) {
    if (first.endMs < second.startMs)
        return second.startMs - first.endMs;
    if (second.endMs < first.startMs)
        return first.startMs - second.endMs;
    return 0;
}
function applyTimeFallback(blocks, assignments) {
    const references = assignments.flatMap((assignment, index) => assignment === null ? [] : [{ assignment, index }]);
    for (let index = 0; index < assignments.length; index += 1) {
        if (assignments[index] !== null)
            continue;
        const nearby = references
            .map((reference) => ({
            ...reference,
            gap: intervalGap(blocks[index], blocks[reference.index]),
        }))
            .filter((reference) => reference.gap <= MAX_TIME_FALLBACK_GAP_MS)
            .sort((left, right) => left.gap - right.gap || left.index - right.index);
        const nearest = nearby.filter((reference) => reference.gap === nearby[0]?.gap);
        if (nearest.length > 0 &&
            nearest.every((reference) => reference.assignment === nearest[0].assignment)) {
            assignments[index] = nearest[0].assignment;
        }
    }
}
function speakerName(index) {
    let value = index + 1;
    let suffix = "";
    while (value > 0) {
        value -= 1;
        suffix = String.fromCharCode(65 + (value % 26)) + suffix;
        value = Math.floor(value / 26);
    }
    return `Speaker ${suffix}`;
}
function assignSpeakers(extracted, centroids, warnings) {
    const assignments = extracted.map((item) => {
        if (item.primary === null)
            return null;
        const assignment = nearestCentroid(item.primary, centroids);
        if (assignment === null) {
            setWarning(warnings, item.block.seq, centroids.length === 0 ? "NO_CLUSTER_REFERENCE" : "LOW_CONFIDENCE");
        }
        return assignment;
    });
    applyTimeFallback(extracted.map((item) => item.block), assignments);
    const speakerNames = new Map();
    const labels = assignments.map((assignment) => {
        if (assignment === null)
            return "UNKNOWN";
        const label = speakerNames.get(assignment) ?? speakerName(speakerNames.size);
        speakerNames.set(assignment, label);
        return label;
    });
    return { labels, speakerCount: speakerNames.size };
}
function metric(value) {
    return Math.max(0, Math.round(value));
}
async function runDiarization(dependencies, reader, blocks, regions) {
    assertInputs(reader, blocks, regions);
    const warnings = new Map();
    const mutable = { embeddedBlockCount: 0, embeddingWindowCount: 0, embedMs: 0, fbankMs: 0 };
    const extracted = await extractBlocks(reader, blocks, regions, dependencies.embeddingModel, warnings, mutable);
    const clusterStarted = performance.now();
    const references = selectReferences(clusterReferences(extracted));
    const centroids = createCentroids(references, dependencies.clusterer);
    const clusterMs = performance.now() - clusterStarted;
    const assignStarted = performance.now();
    const assigned = assignSpeakers(extracted, centroids, warnings);
    const assignMs = performance.now() - assignStarted;
    const unknownBlockCount = assigned.labels.filter((label) => label === "UNKNOWN").length;
    return {
        metrics: {
            assignMs: metric(assignMs),
            clusterMs: metric(clusterMs),
            embeddedBlockCount: mutable.embeddedBlockCount,
            embeddingWindowCount: mutable.embeddingWindowCount,
            embedMs: metric(mutable.embedMs),
            fbankMs: metric(mutable.fbankMs),
            unknownBlockCount,
        },
        resultReason: unknownBlockCount > 0 ? "unknown_speaker_segments" : null,
        resultStatus: unknownBlockCount > 0 ? "partial" : "completed",
        segments: blocks.map((block, index) => ({ ...block, speakerLabel: assigned.labels[index] })),
        speakerCount: assigned.speakerCount,
        warnings: [...warnings.values()].sort((a, b) => a.seq - b.seq).slice(0, MAX_WARNINGS),
    };
}
export function createMeetingDiarizer(dependencies) {
    let closed = false;
    let running = false;
    return {
        async close() {
            if (closed)
                return;
            if (running)
                inputFailure("Cannot close diarizer while it is running");
            closed = true;
            await dependencies.embeddingModel.close();
        },
        async diarize(reader, blocks, speechRegions) {
            if (closed || running)
                inputFailure("Diarizer is unavailable");
            running = true;
            try {
                return await runDiarization(dependencies, reader, blocks, speechRegions);
            }
            finally {
                running = false;
            }
        },
    };
}
//# sourceMappingURL=meeting-diarizer.js.map