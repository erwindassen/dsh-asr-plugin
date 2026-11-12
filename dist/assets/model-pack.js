import { createHash } from "node:crypto";
import { posix } from "node:path";
import { RuntimeAssetsError } from "./runtime-assets-error.js";
const PUNCTUATION_IDS = new Set(["punc-config", "punc-model", "punc-tokens"]);
const PARAKEET_PREFIX = "parakeet-";
/** Language-agnostic acoustic assets shared by every recognizer family. */
const SHARED_IDS = new Set(["vad-model", "speaker-embedding-model"]);
export function isPunctuationAsset(asset) {
    return PUNCTUATION_IDS.has(asset.id);
}
export function isParakeetAsset(asset) {
    return asset.id.startsWith(PARAKEET_PREFIX);
}
export function isSharedAsset(asset) {
    return SHARED_IDS.has(asset.id);
}
export function modelPackAssets(manifest, pack) {
    return runtimeModelAssets(manifest).filter((asset) => {
        if (pack === undefined)
            return true;
        if (pack === "parakeet")
            return isParakeetAsset(asset) || isSharedAsset(asset);
        return !isParakeetAsset(asset) && isPunctuationAsset(asset) === (pack === "punctuation");
    });
}
export function modelPackFingerprint(manifest, pack) {
    return modelSetFingerprint({ ...manifest, assets: modelPackAssets(manifest, pack) });
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, keys) {
    return keys.every((key) => Object.hasOwn(value, key)) &&
        Object.keys(value).every((key) => keys.includes(key));
}
function isSafeRelativePath(value) {
    if (typeof value !== "string" || value.length === 0 || value.length > 4_096 ||
        value.includes("\\") || posix.isAbsolute(value))
        return false;
    const parts = value.split("/");
    return parts.every((part) => part.length > 0 && part !== "." && part !== "..") &&
        posix.normalize(value) === value;
}
function runtimeModelAssets(manifest) {
    return manifest.assets
        .filter((asset) => asset.kind !== "native")
        .sort(compareAssetIds);
}
function compareAssetIds(left, right) {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
function canonicalModelRecords(assets) {
    return [...assets]
        .sort(compareAssetIds)
        .map(({ byteLength, id, relativePath, sha256 }) => ({
        id,
        relativePath,
        byteLength,
        sha256,
    }));
}
function compatibleModelRecords(assets) {
    return [...assets].sort(compareAssetIds).map(({ byteLength, id, kind, relativePath, sha256 }) => ({
        id,
        kind,
        relativePath,
        byteLength,
        sha256,
    }));
}
export function modelSetFingerprint(manifest) {
    const bytes = JSON.stringify(canonicalModelRecords(runtimeModelAssets(manifest)));
    return createHash("sha256").update(bytes).digest("hex");
}
function parseAsset(value) {
    if (!isRecord(value) ||
        !hasExactKeys(value, ["id", "kind", "relativePath", "byteLength", "sha256"]) ||
        typeof value.id !== "string" || !/^[a-z][a-z0-9._-]*$/u.test(value.id) ||
        !["config", "model", "tokens"].includes(String(value.kind)) ||
        !isSafeRelativePath(value.relativePath) || !value.relativePath.startsWith("models/") ||
        !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) <= 0 ||
        typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(value.sha256)) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack asset is invalid");
    }
    return value;
}
function parseMaterial(value) {
    if (!isRecord(value) ||
        !hasExactKeys(value, ["relativePath", "byteLength", "sha256"]) ||
        !isSafeRelativePath(value.relativePath) || value.relativePath.startsWith("models/") ||
        value.relativePath === "model-pack.json" ||
        !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) <= 0 ||
        Number(value.byteLength) > 8 * 1_024 * 1_024 ||
        typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(value.sha256)) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack material is invalid");
    }
    return value;
}
function assertUniquePaths(manifest) {
    const paths = [
        ...manifest.assets.map(({ relativePath }) => relativePath),
        ...manifest.materials.map(({ relativePath }) => relativePath),
    ];
    if (new Set(paths).size !== paths.length) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack paths are duplicated");
    }
    const materialPaths = new Set(manifest.materials.map(({ relativePath }) => relativePath));
    if (!materialPaths.has("LICENSE") || !materialPaths.has("THIRD_PARTY_NOTICES.md")) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack license material is incomplete");
    }
}
function assertCompatible(pack, runtime) {
    const kind = pack.schemaVersion === 2 ? pack.packKind : undefined;
    const expectedAssets = modelPackAssets(runtime, kind);
    if ((pack.schemaVersion === 2 &&
        pack.compatibilityFingerprint !== modelSetFingerprint(runtime)) ||
        pack.modelSetFingerprint !== modelPackFingerprint(runtime, kind) ||
        JSON.stringify(compatibleModelRecords(pack.assets)) !==
            JSON.stringify(compatibleModelRecords(expectedAssets))) {
        throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Model pack does not match the packaged runtime manifest");
    }
}
function parseContents(value) {
    const keys = ["schemaVersion", "modelSetFingerprint", "assets", "materials"];
    if (isRecord(value) && value.schemaVersion === 2) {
        keys.push("packKind", "compatibilityFingerprint");
    }
    if (!isRecord(value) ||
        !hasExactKeys(value, keys) ||
        (value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
        (value.schemaVersion === 2 &&
            ((value.packKind !== "base" && value.packKind !== "parakeet" && value.packKind !== "punctuation") ||
                typeof value.compatibilityFingerprint !== "string" ||
                !/^[0-9a-f]{64}$/u.test(value.compatibilityFingerprint))) ||
        typeof value.modelSetFingerprint !== "string" ||
        !/^[0-9a-f]{64}$/u.test(value.modelSetFingerprint) ||
        !Array.isArray(value.assets) || value.assets.length === 0 ||
        !Array.isArray(value.materials) || value.materials.length < 2 ||
        value.materials.length > 64) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack manifest is invalid");
    }
    const contents = {
        schemaVersion: 1,
        modelSetFingerprint: value.modelSetFingerprint,
        assets: value.assets.map(parseAsset),
        materials: value.materials.map(parseMaterial),
    };
    if (value.schemaVersion === 1)
        return { ...contents, schemaVersion: 1 };
    return { ...contents, schemaVersion: 2, packKind: value.packKind,
        compatibilityFingerprint: value.compatibilityFingerprint };
}
export function parseModelPackManifest(bytes, runtime) {
    let value;
    try {
        value = JSON.parse(bytes.toString("utf8"));
    }
    catch {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack manifest is invalid");
    }
    const manifest = parseContents(value);
    assertUniquePaths(manifest);
    assertCompatible(manifest, runtime);
    return manifest;
}
//# sourceMappingURL=model-pack.js.map