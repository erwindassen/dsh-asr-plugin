import { FunAsrError } from "./errors.js";
const FROZEN_FRONTEND = {
    frameLengthMs: 25,
    frameShiftMs: 10,
    inputSize: 560,
    lfrM: 7,
    lfrN: 6,
    numMels: 80,
    predictorBias: 1,
    sampleRate: 16_000,
    window: "hamming",
};
const FROZEN_PUNCTUATION = ["<unk>", "_", "，", "。", "？", "、"];
const MAX_TOKEN_COUNT = 300_000;
function mismatch(message, cause) {
    throw new FunAsrError("ASSET_MISMATCH", message, cause === undefined ? undefined : { cause });
}
function parseScalar(raw) {
    const value = raw.trim().replace(/^['"]|['"]$/g, "");
    const number = Number(value);
    return value !== "" && Number.isFinite(number) ? number : value;
}
function sectionLines(content, section) {
    const lines = content.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === `${section}:`);
    if (start < 0)
        mismatch(`Missing FunASR ${section} section`);
    const baseIndent = lines[start].search(/\S|$/);
    const output = [];
    for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === "" || line.trimStart().startsWith("#"))
            continue;
        if (line.search(/\S|$/) <= baseIndent)
            break;
        output.push(line);
    }
    return output;
}
function sectionScalars(content, section) {
    const values = new Map();
    for (const line of sectionLines(content, section)) {
        const match = /^\s*([A-Za-z0-9_]+):\s*(.+?)\s*$/.exec(line);
        if (match !== null)
            values.set(match[1], parseScalar(match[2]));
    }
    return values;
}
function sectionList(content, section, key) {
    const lines = sectionLines(content, section);
    const keyIndex = lines.findIndex((line) => line.trim() === `${key}:`);
    if (keyIndex < 0)
        mismatch(`Missing FunASR ${key} list`);
    const keyIndent = lines[keyIndex].search(/\S|$/);
    const values = [];
    for (let index = keyIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim() === "" || line.trimStart().startsWith("#"))
            continue;
        if (line.search(/\S|$/) <= keyIndent)
            break;
        const match = /^\s*-\s*(.+?)\s*$/.exec(line);
        if (match !== null)
            values.push(String(parseScalar(match[1])));
    }
    return values;
}
function rootScalar(content, key, fallback) {
    const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(content);
    return match === null ? fallback : parseScalar(match[1]);
}
export function parseFunAsrFrontendConfig(content) {
    const frontend = sectionScalars(content, "frontend_conf");
    const model = sectionScalars(content, "model_conf");
    const actual = {
        frameLengthMs: frontend.get("frame_length"),
        frameShiftMs: frontend.get("frame_shift"),
        inputSize: rootScalar(content, "input_size", 560),
        lfrM: frontend.get("lfr_m"),
        lfrN: frontend.get("lfr_n"),
        numMels: frontend.get("n_mels"),
        predictorBias: model.get("predictor_bias"),
        sampleRate: frontend.get("fs"),
        window: frontend.get("window"),
    };
    for (const [key, expected] of Object.entries(FROZEN_FRONTEND)) {
        if (actual[key] !== expected)
            mismatch(`FunASR frontend ${key} drifted`);
    }
    return { ...FROZEN_FRONTEND };
}
export function parseFunAsrPunctuationConfig(content) {
    const model = sectionScalars(content, "model_conf");
    const list = sectionList(content, "model_conf", "punc_list");
    if (model.get("sentence_end_id") !== 3 ||
        list.length !== FROZEN_PUNCTUATION.length ||
        list.some((value, index) => value !== FROZEN_PUNCTUATION[index])) {
        mismatch("FunASR punctuation configuration drifted");
    }
    return { punctuationList: [...FROZEN_PUNCTUATION], sentenceEndId: 3 };
}
function parseCmvnVector(content, marker) {
    const expression = new RegExp(`<${marker}>[\\s\\S]*?<LearnRateCoef>\\s+\\S+\\s+\\[\\s*([\\s\\S]*?)\\s*\\]`);
    const match = expression.exec(content);
    if (match === null)
        mismatch(`Missing FunASR ${marker} vector`);
    const values = match[1].trim().split(/\s+/).filter(Boolean).map(Number);
    if (values.length !== 560 || !values.every(Number.isFinite)) {
        mismatch(`Invalid FunASR ${marker} vector`);
    }
    return Float32Array.from(values);
}
export function parseFunAsrCmvn(content) {
    return {
        addShift: parseCmvnVector(content, "AddShift"),
        rescale: parseCmvnVector(content, "Rescale"),
    };
}
export function parseTokenList(content) {
    let value;
    try {
        value = JSON.parse(content);
    }
    catch (error) {
        mismatch("Invalid FunASR token JSON", error);
    }
    if (!Array.isArray(value) ||
        value.length < 3 ||
        value.length > MAX_TOKEN_COUNT ||
        value.some((token) => typeof token !== "string" || token === "") ||
        value.at(-1) !== "<unk>" ||
        new Set(value).size !== value.length) {
        mismatch("Invalid FunASR token list");
    }
    return value;
}
//# sourceMappingURL=config.js.map