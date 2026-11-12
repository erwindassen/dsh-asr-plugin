import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile, } from "node:fs/promises";
import { join } from "node:path";
const KEY = /^[0-9a-f]{64}$/;
const MAX_BLOCKS = 20_000;
const MAX_ASR_BYTES = 24 * 1024 * 1024;
const EMBEDDING_VALUES = 256;
const EMBEDDING_BYTES = EMBEDDING_VALUES * Float32Array.BYTES_PER_ELEMENT;
const HASH_BYTES = 32;
function assertKey(key) {
    if (!KEY.test(key))
        throw new TypeError("Recording cache key must be SHA-256");
}
export function recordingCacheKey(kind, engineFingerprint, startMs, endMs, samples) {
    if (!KEY.test(engineFingerprint) || !Number.isSafeInteger(startMs) ||
        !Number.isSafeInteger(endMs) || startMs < 0 || endMs <= startMs ||
        !(samples instanceof Float32Array) || samples.length < 1 || !samples.every(Number.isFinite))
        throw new TypeError("Recording cache identity is invalid");
    const content = createHash("sha256")
        .update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength))
        .digest("hex");
    return createHash("sha256")
        .update(`${kind}\0${engineFingerprint}\0${startMs}\0${endMs}\0${content}`)
        .digest("hex");
}
function validBlocks(value) {
    if (!Array.isArray(value) || value.length > MAX_BLOCKS)
        return false;
    let previousEnd = 0;
    return value.every((item, index) => {
        if (typeof item !== "object" || item === null || Array.isArray(item))
            return false;
        const block = item;
        return Object.keys(block).length === 4 &&
            block.seq === index && Number.isSafeInteger(block.startMs) &&
            Number.isSafeInteger(block.endMs) && block.startMs >= previousEnd &&
            block.endMs > block.startMs &&
            typeof block.text === "string" && block.text.length > 0 &&
            block.text.length <= 20_000 && block.text.trim().length > 0 &&
            ((previousEnd = block.endMs), true);
    });
}
function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
function sealedAsr(blocks) {
    const payload = JSON.stringify(blocks);
    return `${JSON.stringify({ payload: blocks, sha256: sha256(payload) })}\n`;
}
function parseSealedAsr(bytes) {
    const value = JSON.parse(bytes.toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return null;
    const record = value;
    if (Object.keys(record).length !== 2 || !validBlocks(record.payload) ||
        typeof record.sha256 !== "string" ||
        record.sha256 !== sha256(JSON.stringify(record.payload)))
        return null;
    return record.payload;
}
async function regularBytes(path, maximum) {
    try {
        const info = await lstat(path);
        if (!info.isFile() || info.size > maximum)
            return null;
        return await readFile(path);
    }
    catch {
        return null;
    }
}
async function atomicWrite(path, bytes) {
    const temporary = `${path}.tmp`;
    await rm(temporary, { force: true });
    try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, path);
    }
    finally {
        await rm(temporary, { force: true }).catch(() => undefined);
    }
}
function embeddingBytes(embedding) {
    if (embedding.length !== EMBEDDING_VALUES || !embedding.every(Number.isFinite)) {
        throw new TypeError("Recording cache embedding is invalid");
    }
    const payload = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    return Buffer.concat([createHash("sha256").update(payload).digest(), payload]);
}
class FileRecordingFinalCache {
    asrRoot;
    embeddingRoot;
    constructor(asrRoot, embeddingRoot) {
        this.asrRoot = asrRoot;
        this.embeddingRoot = embeddingRoot;
    }
    async getAsr(key) {
        assertKey(key);
        const bytes = await regularBytes(join(this.asrRoot, `${key}.json`), MAX_ASR_BYTES);
        if (bytes === null)
            return null;
        try {
            return parseSealedAsr(bytes);
        }
        catch {
            return null;
        }
    }
    async getEmbedding(key) {
        assertKey(key);
        const bytes = await regularBytes(join(this.embeddingRoot, `${key}.bin`), HASH_BYTES + EMBEDDING_BYTES);
        if (bytes === null || bytes.byteLength !== HASH_BYTES + EMBEDDING_BYTES)
            return null;
        const payload = bytes.subarray(HASH_BYTES);
        if (!createHash("sha256").update(payload).digest().equals(bytes.subarray(0, HASH_BYTES))) {
            return null;
        }
        const copy = new Float32Array(EMBEDDING_VALUES);
        Buffer.from(copy.buffer).set(payload);
        return copy.every(Number.isFinite) ? copy : null;
    }
    async putAsr(key, blocks) {
        assertKey(key);
        if (!validBlocks(blocks))
            throw new TypeError("Recording cache ASR blocks are invalid");
        const bytes = sealedAsr(blocks);
        if (Buffer.byteLength(bytes) > MAX_ASR_BYTES) {
            throw new TypeError("Recording cache ASR entry is too large");
        }
        await atomicWrite(join(this.asrRoot, `${key}.json`), bytes);
    }
    async putEmbedding(key, embedding) {
        assertKey(key);
        await atomicWrite(join(this.embeddingRoot, `${key}.bin`), embeddingBytes(embedding));
    }
}
export async function openRecordingFinalCache(root, engineFingerprint) {
    if (!KEY.test(engineFingerprint))
        throw new TypeError("Recording cache fingerprint is invalid");
    const profile = join(root, engineFingerprint);
    const asrRoot = join(profile, "asr");
    const embeddingRoot = join(profile, "embedding");
    for (const directory of [root, profile, asrRoot, embeddingRoot]) {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await chmod(directory, 0o700);
    }
    return new FileRecordingFinalCache(asrRoot, embeddingRoot);
}
//# sourceMappingURL=final-cache.js.map