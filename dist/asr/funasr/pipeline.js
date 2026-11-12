import { baseBlocks, baseTokenUnits } from "./base-segmentation.js";
import { FunAsrError } from "./errors.js";
import { buildSentenceBlocks, buildTokenUnits } from "./text.js";
const SAMPLE_RATE = 16_000;
const MAX_CHUNK_MS = 60_000;
const MAX_CHUNKS = 20_000;
const MAX_BLOCKS = 20_000;
const TIMESTAMP_END_TOLERANCE_MS = 40;
function inferenceFailure(message, cause) {
    return new FunAsrError("MODEL_INFERENCE_FAILED", message, cause === undefined ? undefined : { cause });
}
function normalizeFailure(error, message) {
    return error instanceof FunAsrError ? error : inferenceFailure(message, error);
}
function assertChunks(chunks, durationMs) {
    if (chunks.length > MAX_CHUNKS)
        throw new FunAsrError("RESOURCE_LIMIT", "Too many ASR chunks");
    let previousEnd = 0;
    for (const chunk of chunks) {
        if (!Number.isSafeInteger(chunk.startMs) ||
            !Number.isSafeInteger(chunk.endMs) ||
            chunk.startMs < previousEnd ||
            chunk.startMs < 0 ||
            chunk.endMs <= chunk.startMs ||
            chunk.endMs > durationMs ||
            chunk.endMs - chunk.startMs > MAX_CHUNK_MS) {
            throw inferenceFailure("Invalid FunASR speech chunk");
        }
        previousEnd = chunk.endMs;
    }
}
function validTimestamps(timestamps, durationMs) {
    let previousEnd = 0;
    for (const [start, end] of timestamps) {
        if (!Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start < previousEnd ||
            start >= durationMs ||
            end <= start ||
            end > durationMs + TIMESTAMP_END_TOLERANCE_MS)
            return false;
        previousEnd = end;
    }
    return true;
}
function assertDraft(draft, region) {
    const times = [draft.frontendMs, draft.inferenceMs];
    const durationMs = region.endMs - region.startMs;
    const empty = draft.tokenCount === 0;
    if (!times.every((value) => Number.isFinite(value) && value >= 0) ||
        !Number.isSafeInteger(draft.featureFrames) ||
        !Number.isSafeInteger(draft.tokenCount) ||
        draft.featureFrames <= 0 ||
        draft.tokenCount < 0 ||
        draft.tokens.length !== draft.tokenCount ||
        draft.tokens.some((token) => token === "") ||
        (empty
            ? draft.rawText.trim() !== "" || draft.puncInput.trim() !== ""
            : draft.rawText.trim() === "" || draft.puncInput.trim() === "") ||
        (draft.timestampsMs !== null && (draft.timestampsMs.length !== draft.tokens.length ||
            !validTimestamps(draft.timestampsMs, durationMs)))) {
        throw inferenceFailure("FunASR returned an empty or invalid speech result");
    }
    return empty;
}
function frameRange(reader, region) {
    const start = Math.floor((region.startMs * SAMPLE_RATE) / 1_000);
    const end = Math.min(reader.metadata.frameCount, Math.ceil((region.endMs * SAMPLE_RATE) / 1_000));
    if (end <= start || end - start > SAMPLE_RATE * 60) {
        throw inferenceFailure("Invalid FunASR PCM range");
    }
    return [start, end];
}
async function closeRecognizer(recognizer, failure) {
    try {
        await recognizer.close();
        return failure;
    }
    catch (error) {
        return failure ?? inferenceFailure("FunASR recognizer failed to close", error);
    }
}
async function recognizeChunks(reader, chunks, factory) {
    let recognizer;
    try {
        recognizer = await factory.loadRecognizer();
    }
    catch (error) {
        throw error instanceof FunAsrError
            ? error
            : new FunAsrError("MODEL_LOAD_FAILED", "FunASR recognizer failed to load", { cause: error });
    }
    let result;
    let failure = null;
    try {
        result = await recognizeWithLoadedRuntime(reader, chunks, recognizer);
    }
    catch (error) {
        failure = normalizeFailure(error, "FunASR recognition failed");
    }
    failure = await closeRecognizer(recognizer, failure);
    if (failure !== null)
        throw failure;
    return result;
}
async function recognizeWithLoadedRuntime(reader, chunks, recognizer) {
    const output = [];
    const metrics = {
        asrInferenceMs: 0,
        chunkCount: 0,
        featureFrames: 0,
        frontendMs: 0,
        tokenCount: 0,
    };
    try {
        for (const region of chunks) {
            const [start, end] = frameRange(reader, region);
            const draft = await recognizer.recognize(await reader.readFrames(start, end));
            const empty = assertDraft(draft, region);
            metrics.asrInferenceMs += draft.inferenceMs;
            metrics.chunkCount += 1;
            metrics.featureFrames += draft.featureFrames;
            metrics.frontendMs += draft.frontendMs;
            metrics.tokenCount += draft.tokenCount;
            if (!empty)
                output.push({ draft, region });
        }
    }
    catch (error) {
        throw normalizeFailure(error, "FunASR recognition failed");
    }
    return { chunks: output, metrics };
}
async function closePunctuator(punctuator, failure) {
    try {
        await punctuator.close();
        return failure;
    }
    catch (error) {
        return failure ?? inferenceFailure("FunASR punctuator failed to close", error);
    }
}
function chunkBlocks(chunk, result, punctuationList) {
    assertPunctuation(chunk, result, punctuationList);
    if (chunk.draft.timestampsMs === null) {
        return [{ ...chunk.region, text: result.text.trim() }];
    }
    return buildSentenceBlocks(chunk.draft.tokens, chunk.draft.timestampsMs, result.punctuationIds, punctuationList, chunk.region.startMs, chunk.region.endMs);
}
function selfPunctuatedChunkBlocks(chunk) {
    const punctuation = assertSelfPunctuation(chunk);
    if (chunk.draft.timestampsMs === null) {
        return [{ ...chunk.region, text: chunk.draft.rawText.trim() }];
    }
    return buildSentenceBlocks(chunk.draft.tokens, chunk.draft.timestampsMs, punctuation.ids, punctuation.list, chunk.region.startMs, chunk.region.endMs);
}
function selfPunctuated(chunks) {
    return chunks.every((chunk) => chunk.draft.punctuation !== undefined);
}
function assertSelfPunctuation(chunk) {
    const punctuation = chunk.draft.punctuation;
    if (punctuation === undefined || punctuation.ids.length !== chunk.draft.tokens.length ||
        punctuation.list.length === 0 || punctuation.list[0] !== "_") {
        throw inferenceFailure("Self-punctuated draft does not align");
    }
    return punctuation;
}
function assertPunctuation(chunk, result, punctuationList) {
    if (result.text.trim() === "" || !Number.isFinite(result.inferenceMs) || result.inferenceMs < 0) {
        throw inferenceFailure("FunASR punctuation returned an invalid result");
    }
    if (result.punctuationIds.length !== chunk.draft.tokens.length ||
        result.punctuationIds.some((id) => !Number.isSafeInteger(id) || id < 0 || id >= punctuationList.length))
        throw inferenceFailure("FunASR punctuation IDs do not align");
}
function chunkTokenUnits(chunk, result, punctuationList) {
    assertPunctuation(chunk, result, punctuationList);
    if (chunk.draft.timestampsMs === null) {
        throw inferenceFailure("FunASR token timestamps are unavailable for recording drafts");
    }
    return buildTokenUnits(chunk.draft.tokens, chunk.draft.timestampsMs, result.punctuationIds, punctuationList, chunk.region.startMs, chunk.region.endMs);
}
function selfPunctuatedChunkUnits(chunk) {
    const punctuation = assertSelfPunctuation(chunk);
    if (chunk.draft.timestampsMs === null) {
        throw inferenceFailure("FunASR token timestamps are unavailable for recording drafts");
    }
    return buildTokenUnits(chunk.draft.tokens, chunk.draft.timestampsMs, punctuation.ids, punctuation.list, chunk.region.startMs, chunk.region.endMs);
}
function selfPunctuatedUnits(chunks) {
    const units = [];
    for (const chunk of chunks) {
        units.push(...selfPunctuatedChunkUnits(chunk));
        if (units.length > MAX_BLOCKS) {
            throw new FunAsrError("RESOURCE_LIMIT", "Too many ASR tokens");
        }
    }
    return units;
}
function selfPunctuatedBlocks(chunks) {
    const blocks = [];
    for (const chunk of chunks) {
        for (const block of selfPunctuatedChunkBlocks(chunk)) {
            blocks.push({ ...block, seq: blocks.length });
            if (blocks.length > MAX_BLOCKS) {
                throw new FunAsrError("RESOURCE_LIMIT", "Too many ASR blocks");
            }
        }
    }
    return blocks;
}
async function punctuateChunks(chunks, factory) {
    if (selfPunctuated(chunks))
        return { blocks: selfPunctuatedBlocks(chunks), inferenceMs: 0 };
    const loadPunctuator = factory.loadPunctuator;
    if (loadPunctuator === undefined) {
        throw new FunAsrError("MODEL_LOAD_FAILED", "Enhanced mode requires punctuation assets");
    }
    let punctuator;
    try {
        punctuator = await loadPunctuator();
    }
    catch (error) {
        throw error instanceof FunAsrError
            ? error
            : new FunAsrError("MODEL_LOAD_FAILED", "FunASR punctuator failed to load", { cause: error });
    }
    let result;
    let failure = null;
    try {
        result = await punctuateWithLoadedRuntime(chunks, punctuator);
    }
    catch (error) {
        failure = normalizeFailure(error, "FunASR punctuation failed");
    }
    failure = await closePunctuator(punctuator, failure);
    if (failure !== null)
        throw failure;
    return result;
}
async function punctuateWithLoadedRuntime(chunks, punctuator) {
    const blocks = [];
    let inferenceMs = 0;
    try {
        for (const chunk of chunks) {
            const result = await punctuator.punctuate(chunk.draft.puncInput);
            inferenceMs += result.inferenceMs;
            for (const block of chunkBlocks(chunk, result, punctuator.punctuationList)) {
                blocks.push({ ...block, seq: blocks.length });
                if (blocks.length > MAX_BLOCKS) {
                    throw new FunAsrError("RESOURCE_LIMIT", "Too many ASR blocks");
                }
            }
        }
    }
    catch (error) {
        throw normalizeFailure(error, "FunASR punctuation failed");
    }
    return { blocks, inferenceMs };
}
async function punctuateDraftWithLoadedRuntime(chunks, punctuator) {
    const units = [];
    let inferenceMs = 0;
    try {
        for (const chunk of chunks) {
            if (chunk.draft.punctuation !== undefined) {
                units.push(...selfPunctuatedChunkUnits(chunk));
            }
            else {
                const result = await punctuator.punctuate(chunk.draft.puncInput);
                inferenceMs += result.inferenceMs;
                units.push(...chunkTokenUnits(chunk, result, punctuator.punctuationList));
            }
            if (units.length > MAX_BLOCKS)
                throw new FunAsrError("RESOURCE_LIMIT", "Too many ASR tokens");
        }
    }
    catch (error) {
        throw normalizeFailure(error, "FunASR draft punctuation failed");
    }
    return { inferenceMs, units };
}
function requirePunctuator(runtime) {
    if (!runtime.punctuator) {
        throw new FunAsrError("MODEL_LOAD_FAILED", "Enhanced mode requires punctuation");
    }
    return runtime.punctuator;
}
function emptyMetrics() {
    return {
        asrInferenceMs: 0,
        chunkCount: 0,
        featureFrames: 0,
        frontendMs: 0,
        punctuationInferenceMs: 0,
        tokenCount: 0,
    };
}
export async function runFunAsr(reader, chunks, factory, mode = "enhanced") {
    assertChunks(chunks, reader.metadata.durationMs);
    if (chunks.length === 0)
        return { blocks: [], emptyReason: "silent", metrics: emptyMetrics() };
    const recognized = await recognizeChunks(reader, chunks, factory);
    if (recognized.chunks.length === 0) {
        return {
            blocks: [],
            emptyReason: "too_short",
            metrics: { ...recognized.metrics, punctuationInferenceMs: 0 },
        };
    }
    const punctuated = mode === "base"
        ? { blocks: baseBlocks(recognized.chunks), inferenceMs: 0 }
        : await punctuateChunks(recognized.chunks, factory);
    if (punctuated.blocks.length === 0)
        throw inferenceFailure("FunASR produced no sentence blocks");
    return {
        blocks: punctuated.blocks,
        emptyReason: null,
        metrics: {
            asrInferenceMs: recognized.metrics.asrInferenceMs,
            chunkCount: recognized.metrics.chunkCount,
            featureFrames: recognized.metrics.featureFrames,
            frontendMs: recognized.metrics.frontendMs,
            punctuationInferenceMs: punctuated.inferenceMs,
            tokenCount: recognized.metrics.tokenCount,
        },
    };
}
export async function runFunAsrWithLoadedRuntime(reader, chunks, runtime) {
    assertChunks(chunks, reader.metadata.durationMs);
    if (chunks.length === 0)
        return { blocks: [], emptyReason: "silent", metrics: emptyMetrics() };
    const recognized = await recognizeWithLoadedRuntime(reader, chunks, runtime.recognizer);
    if (recognized.chunks.length === 0) {
        return {
            blocks: [],
            emptyReason: "too_short",
            metrics: { ...recognized.metrics, punctuationInferenceMs: 0 },
        };
    }
    const punctuated = runtime.mode === "base"
        ? { blocks: baseBlocks(recognized.chunks), inferenceMs: 0 }
        : selfPunctuated(recognized.chunks)
            ? { blocks: selfPunctuatedBlocks(recognized.chunks), inferenceMs: 0 }
            : await punctuateWithLoadedRuntime(recognized.chunks, requirePunctuator(runtime));
    if (punctuated.blocks.length === 0)
        throw inferenceFailure("FunASR produced no sentence blocks");
    return {
        blocks: punctuated.blocks,
        emptyReason: null,
        metrics: {
            asrInferenceMs: recognized.metrics.asrInferenceMs,
            chunkCount: recognized.metrics.chunkCount,
            featureFrames: recognized.metrics.featureFrames,
            frontendMs: recognized.metrics.frontendMs,
            punctuationInferenceMs: punctuated.inferenceMs,
            tokenCount: recognized.metrics.tokenCount,
        },
    };
}
export async function runFunAsrDraftWithLoadedRuntime(reader, chunks, runtime) {
    assertChunks(chunks, reader.metadata.durationMs);
    if (chunks.length === 0)
        return { units: [], emptyReason: "silent", metrics: emptyMetrics() };
    const recognized = await recognizeWithLoadedRuntime(reader, chunks, runtime.recognizer);
    if (recognized.chunks.length === 0) {
        return {
            units: [],
            emptyReason: "too_short",
            metrics: { ...recognized.metrics, punctuationInferenceMs: 0 },
        };
    }
    const punctuated = runtime.mode === "base"
        ? { units: baseTokenUnits(recognized.chunks), inferenceMs: 0 }
        : selfPunctuated(recognized.chunks)
            ? { units: selfPunctuatedUnits(recognized.chunks), inferenceMs: 0 }
            : await punctuateDraftWithLoadedRuntime(recognized.chunks, requirePunctuator(runtime));
    if (punctuated.units.length === 0)
        throw inferenceFailure("FunASR produced no token units");
    return {
        units: punctuated.units,
        emptyReason: null,
        metrics: {
            asrInferenceMs: recognized.metrics.asrInferenceMs,
            chunkCount: recognized.metrics.chunkCount,
            featureFrames: recognized.metrics.featureFrames,
            frontendMs: recognized.metrics.frontendMs,
            punctuationInferenceMs: punctuated.inferenceMs,
            tokenCount: recognized.metrics.tokenCount,
        },
    };
}
//# sourceMappingURL=pipeline.js.map