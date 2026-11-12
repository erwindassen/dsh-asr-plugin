import { renderRecordingWindow, } from "../audio/recording-timeline.js";
import { PCM_SAMPLE_RATE } from "../audio/wav-reader.js";
import { parseRecordingWorkerMessage } from "./worker-messages.js";
const CADENCE_FRAMES = PCM_SAMPLE_RATE * 5;
const OVERLAP_FRAMES = PCM_SAMPLE_RATE * 3;
const OVERLAP_MILLISECONDS = 3_000;
const MAX_WINDOW_UNITS = 20_000;
const MAX_SEGMENTS = 20_000;
const MAX_TEXT_LENGTH = 20_000;
const TARGET_SEGMENT_LENGTH = 1_000;
export class RecordingDraftResourceError extends Error {
    code = "RESOURCE_LIMIT";
    constructor(message) {
        super(message);
        this.name = "RecordingDraftResourceError";
    }
}
function millisecondsForFrames(frames) {
    return Math.ceil((frames * 1_000) / PCM_SAMPLE_RATE);
}
function framesForMicroseconds(microseconds) {
    return Math.round((microseconds * PCM_SAMPLE_RATE) / 1_000_000);
}
function assertUnits(units, durationMs) {
    if (units.length > MAX_WINDOW_UNITS) {
        throw new RecordingDraftResourceError("Recording draft has too many units");
    }
    let priorEnd = -1;
    for (const unit of units) {
        if (typeof unit.breakAfter !== "boolean" ||
            !Number.isSafeInteger(unit.startMs) ||
            !Number.isSafeInteger(unit.endMs) ||
            unit.startMs < priorEnd ||
            unit.startMs < 0 ||
            unit.endMs <= unit.startMs ||
            unit.endMs > durationMs ||
            unit.text.length < 1 ||
            unit.text.length > MAX_TEXT_LENGTH ||
            unit.text.trim().length === 0)
            throw new TypeError("Recording draft unit is invalid");
        priorEnd = unit.endMs;
    }
}
function appendToken(current, token) {
    if (current === "")
        return token;
    return /^[A-Za-z0-9]/u.test(token) || /[A-Za-z0-9]$/u.test(current)
        ? `${current} ${token}`
        : `${current}${token}`;
}
function segmentFrom(units, text) {
    return {
        start_ms: units[0].startMs,
        end_ms: units.at(-1).endMs,
        speaker_label: null,
        text: text.trim(),
    };
}
function segmentsForUnits(units) {
    const blocks = [];
    let pending = [];
    let text = "";
    const flush = () => {
        if (pending.length > 0)
            blocks.push(segmentFrom(pending, text));
        pending = [];
        text = "";
    };
    for (const unit of units) {
        const candidate = appendToken(text, unit.text);
        if (text !== "" && candidate.length > TARGET_SEGMENT_LENGTH)
            flush();
        pending.push(unit);
        text = appendToken(text, unit.text);
        if (unit.breakAfter)
            flush();
    }
    flush();
    if (blocks.length > MAX_SEGMENTS) {
        throw new RecordingDraftResourceError("Recording draft has too many segments");
    }
    return blocks.map((block, seq) => ({ ...block, seq }));
}
function absoluteUnits(units, offsetMs) {
    return units.map((unit) => ({
        ...unit,
        startMs: unit.startMs + offsetMs,
        endMs: unit.endMs + offsetMs,
    }));
}
function stitchUnits(previous, current, plan) {
    const offsetMs = millisecondsForFrames(plan.startFrame);
    const incoming = absoluteUnits(current, offsetMs);
    if (plan.reset)
        return incoming;
    if (incoming.length === 0)
        return [...previous];
    const seamMs = Math.max(offsetMs, millisecondsForFrames(plan.boundaryFrame) - OVERLAP_MILLISECONDS / 2);
    const beforeSeam = (unit) => (unit.startMs + unit.endMs) / 2 < seamMs;
    return [...previous.filter(beforeSeam), ...incoming.filter((unit) => !beforeSeam(unit))];
}
function sharedPrefixLength(previous, current) {
    const maximum = Math.min(previous.length, current.length);
    let index = 0;
    while (index < maximum) {
        const left = previous[index];
        const right = current[index];
        if (left.start_ms !== right.start_ms || left.end_ms !== right.end_ms || left.text !== right.text) {
            break;
        }
        index += 1;
    }
    return index;
}
export class RecordingDraftEngine {
    options;
    now;
    originUs;
    processedThroughFrames = 0;
    revision = 0;
    units = [];
    segments = [];
    constructor(options) {
        this.options = options;
        this.now = options.now ?? Date.now;
    }
    async nextRevision() {
        const timeline = await this.options.chunks.scan();
        if (timeline === null)
            return null;
        const plan = this.plan(timeline);
        if (plan === null)
            return null;
        const samples = await renderRecordingWindow(timeline, plan.startFrame, plan.endFrame, (chunk, start, end) => this.options.chunks.read(chunk, start, end));
        const recognized = await this.options.recognize(samples);
        assertUnits(recognized, millisecondsForFrames(plan.endFrame - plan.startFrame));
        const units = stitchUnits(this.units, recognized, plan);
        const segments = segmentsForUnits(units);
        const message = this.message(plan, segments);
        parseRecordingWorkerMessage(message);
        this.accept(timeline, plan, units, segments, message);
        return message;
    }
    plan(timeline) {
        const reset = this.originUs !== undefined && timeline.originUs !== this.originUs;
        const through = reset ? 0 : this.processedThroughFrames;
        if (!reset && timeline.frameCount <= through)
            return null;
        const priorOrigin = this.originUs ?? timeline.originUs;
        const priorAbsoluteEndUs = priorOrigin + Math.round((this.processedThroughFrames * 1_000_000) / PCM_SAMPLE_RATE);
        const replayThrough = framesForMicroseconds(priorAbsoluteEndUs - timeline.originUs);
        const minimumEnd = reset
            ? Math.max(CADENCE_FRAMES, replayThrough)
            : through + CADENCE_FRAMES;
        if (timeline.frameCount < minimumEnd)
            return null;
        return {
            boundaryFrame: reset ? 0 : through,
            endFrame: minimumEnd,
            reset,
            startFrame: reset ? 0 : Math.max(0, through - OVERLAP_FRAMES),
        };
    }
    message(plan, segments) {
        const replace = plan.reset ? 0 : sharedPrefixLength(this.segments, segments);
        return {
            type: "revision",
            revision: this.revision + 1,
            base_revision: this.revision,
            replace_from_seq: replace,
            audio_through_ms: millisecondsForFrames(plan.endFrame),
            generated_at_ms: Math.trunc(this.now()),
            segments: segments.slice(replace),
        };
    }
    accept(timeline, plan, units, segments, message) {
        this.units = units;
        this.segments = segments;
        this.revision = message.revision;
        this.originUs = timeline.originUs;
        this.processedThroughFrames = plan.endFrame;
    }
}
//# sourceMappingURL=draft-engine.js.map