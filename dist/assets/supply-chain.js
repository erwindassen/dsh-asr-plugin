import { readFile } from "node:fs/promises";
import { readAssetManifest } from "./verify-assets.js";
export class SupplyChainError extends Error {
    code = "SUPPLY_CHAIN_INVALID";
    entryId;
    constructor(message, entryId) {
        super(message);
        this.name = "SupplyChainError";
        this.entryId = entryId;
    }
}
function invalid(message, entryId) {
    throw new SupplyChainError(message, entryId);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, required, optional = []) {
    const allowed = new Set([...required, ...optional]);
    return required.every((key) => Object.hasOwn(value, key)) &&
        Object.keys(value).every((key) => allowed.has(key));
}
function isHttpsUrl(value) {
    if (typeof value !== "string")
        return false;
    try {
        return new URL(value).protocol === "https:";
    }
    catch {
        return false;
    }
}
function isSourcePath(value) {
    return typeof value === "string" && value.length > 0 &&
        !value.startsWith("/") && !value.split(/[\\/]/u).includes("..");
}
function parseTransports(value, entryId) {
    if (!Array.isArray(value) || value.length === 0)
        invalid("Missing transports", entryId);
    const transports = value.map((item) => {
        if (!isRecord(item))
            invalid("Invalid transport", entryId);
        if ((item.kind === "user-authorized-staging" || item.kind === "vendored-source") &&
            hasExactKeys(item, ["kind"])) {
            return { kind: item.kind };
        }
        if (!hasExactKeys(item, ["kind", "url"]) ||
            !["canonical", "cn-mirror", "fallback", "npm"].includes(String(item.kind)) || !isHttpsUrl(item.url)) {
            invalid("Invalid transport", entryId);
        }
        return item;
    });
    if (new Set(transports.map(({ kind }) => kind)).size !== transports.length) {
        invalid("Duplicate transport kind", entryId);
    }
    return transports;
}
function parseStringList(value, entryId, allowEmpty) {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
        value.some((item) => typeof item !== "string" || item.length === 0) ||
        new Set(value).size !== value.length) {
        invalid("Invalid string list", entryId);
    }
    return value;
}
function parseSource(value, entryId) {
    const transports = parseTransports(value.transports, entryId);
    const publicLicense = value.distribution !== "public" || value.license !== "NOASSERTION";
    const licenseFiles = parseStringList(value.licenseFiles, entryId, value.distribution === "closed-pilot-only" && value.license === "NOASSERTION");
    if (licenseFiles.some((path) => !isSourcePath(path)))
        invalid("Invalid license path", entryId);
    const citations = value.citations === undefined ? [] :
        parseStringList(value.citations, entryId, true);
    const publicTransport = value.distribution !== "public" ||
        transports.every(({ kind }) => kind !== "user-authorized-staging");
    const validTransportMode = transports.every(({ kind }) => kind !== "user-authorized-staging" || value.sourceMode === "reuse") &&
        transports.every(({ kind }) => kind !== "vendored-source" || value.sourceMode === "rebuild");
    if ((value.sourceMode !== "rebuild" && value.sourceMode !== "reuse") ||
        !isHttpsUrl(value.canonicalRepository) ||
        typeof value.revision !== "string" || !/^[0-9a-f]{40}$/u.test(value.revision) ||
        !isSourcePath(value.sourcePath) || typeof value.license !== "string" ||
        value.license.length === 0 || !publicLicense || !publicTransport || !validTransportMode ||
        typeof value.attribution !== "string" ||
        value.attribution.length === 0 ||
        (value.distribution !== "public" && value.distribution !== "closed-pilot-only")) {
        invalid("Invalid source facts", entryId);
    }
    return {
        attribution: value.attribution,
        canonicalRepository: value.canonicalRepository,
        citations,
        distribution: value.distribution,
        license: value.license,
        licenseFiles,
        revision: value.revision,
        sourceMode: value.sourceMode,
        sourcePath: value.sourcePath,
        transports,
    };
}
function parseBuildTarget(value, entryId) {
    if (value === undefined)
        return undefined;
    if (!isRecord(value) || !hasExactKeys(value, ["platform", "architecture", "napi"]) ||
        typeof value.platform !== "string" || value.platform.length === 0 ||
        typeof value.architecture !== "string" || value.architecture.length === 0 ||
        !Number.isSafeInteger(value.napi) || Number(value.napi) <= 0) {
        invalid("Invalid build target", entryId);
    }
    return value;
}
const SOURCE_KEYS = [
    "sourceMode", "canonicalRepository", "revision", "sourcePath", "license",
    "licenseFiles", "attribution", "distribution", "transports",
];
function parseAsset(value) {
    if (!isRecord(value))
        invalid("Invalid asset entry");
    const entryId = typeof value.id === "string" ? value.id : "unknown";
    if (!hasExactKeys(value, ["id", ...SOURCE_KEYS], ["buildTarget", "citations"]) ||
        !/^[a-z][a-z0-9._-]*$/u.test(entryId)) {
        invalid("Invalid asset entry", entryId);
    }
    const buildTarget = parseBuildTarget(value.buildTarget, entryId);
    return { id: entryId, ...parseSource(value, entryId),
        ...(buildTarget === undefined ? {} : { buildTarget }) };
}
function parseFiles(value, entryId) {
    if (!Array.isArray(value) || value.length === 0)
        invalid("Missing supply files", entryId);
    const files = value.map((item) => {
        if (!isRecord(item) || !hasExactKeys(item, ["path", "byteLength", "sha256"]) ||
            !isSourcePath(item.path) || !Number.isSafeInteger(item.byteLength) ||
            Number(item.byteLength) <= 0 || typeof item.sha256 !== "string" ||
            !/^[0-9a-f]{64}$/u.test(item.sha256)) {
            invalid("Invalid supply file", entryId);
        }
        return item;
    });
    if (new Set(files.map(({ path }) => path)).size !== files.length) {
        invalid("Duplicate supply file", entryId);
    }
    return files;
}
function parseNoticeFiles(value, entryId) {
    if (!Array.isArray(value) || value.length === 0)
        invalid("Missing notice files", entryId);
    const files = value.map((item) => {
        if (!isRecord(item) ||
            !hasExactKeys(item, ["path", "deliveryPath", "byteLength", "sha256"]) ||
            !isSourcePath(item.path) || !isSourcePath(item.deliveryPath) ||
            !Number.isSafeInteger(item.byteLength) || Number(item.byteLength) <= 0 ||
            typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(item.sha256)) {
            invalid("Invalid notice file", entryId);
        }
        return item;
    });
    if (new Set(files.map(({ deliveryPath }) => deliveryPath)).size !== files.length) {
        invalid("Duplicate notice file", entryId);
    }
    return files;
}
function parseDependencyRuntime(value, entryId) {
    const keys = ["platform", "architecture", "nodeMajor", "addonNapi", "verifiedNapi"];
    if (!isRecord(value) || !hasExactKeys(value, keys) ||
        typeof value.platform !== "string" || value.platform.length === 0 ||
        typeof value.architecture !== "string" || value.architecture.length === 0 ||
        !Number.isSafeInteger(value.nodeMajor) || Number(value.nodeMajor) <= 0 ||
        !Number.isSafeInteger(value.addonNapi) || Number(value.addonNapi) <= 0 ||
        !Number.isSafeInteger(value.verifiedNapi) || Number(value.verifiedNapi) <= 0 ||
        Number(value.verifiedNapi) < Number(value.addonNapi)) {
        invalid("Invalid dependency runtime", entryId);
    }
    return value;
}
function parseDependency(value) {
    if (!isRecord(value))
        invalid("Invalid dependency entry");
    const entryId = typeof value.id === "string" ? value.id : "unknown";
    const keys = ["id", ...SOURCE_KEYS, "packageName", "version", "integrity", "runtime",
        "artifacts", "noticeFiles"];
    if (!hasExactKeys(value, keys, ["citations"]) || entryId !== "onnxruntime-node" ||
        value.packageName !== "onnxruntime-node" || value.version !== "1.19.2" ||
        typeof value.integrity !== "string" ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(value.integrity)) {
        invalid("Invalid dependency entry", entryId);
    }
    return { id: "onnxruntime-node", packageName: "onnxruntime-node", version: "1.19.2",
        integrity: value.integrity, ...parseSource(value, entryId),
        runtime: parseDependencyRuntime(value.runtime, entryId),
        artifacts: parseFiles(value.artifacts, entryId),
        noticeFiles: parseNoticeFiles(value.noticeFiles, entryId) };
}
function parseManifest(value) {
    if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "assets", "dependencies"]) ||
        value.schemaVersion !== 1 || !Array.isArray(value.assets) ||
        !Array.isArray(value.dependencies) || value.dependencies.length !== 1) {
        invalid("Invalid supply-chain manifest");
    }
    const assets = value.assets.map(parseAsset);
    if (new Set(assets.map(({ id }) => id)).size !== assets.length) {
        invalid("Duplicate asset id");
    }
    return { schemaVersion: 1, assets, dependencies: [parseDependency(value.dependencies[0])] };
}
function assertRuntimeCoverage(runtimeIds, supplyIds) {
    const runtime = new Set(runtimeIds);
    const supply = new Set(supplyIds);
    const mismatch = runtimeIds.find((id) => !supply.has(id)) ??
        supplyIds.find((id) => !runtime.has(id));
    if (mismatch !== undefined || runtime.size !== supply.size) {
        invalid("Supply-chain assets do not cover runtime manifest", mismatch);
    }
}
export async function readSupplyChainManifest(options) {
    try {
        const [runtimeManifest, supplyBytes] = await Promise.all([
            readAssetManifest(options.runtimeManifestPath),
            readFile(options.supplyChainPath, "utf8"),
        ]);
        const manifest = parseManifest(JSON.parse(supplyBytes));
        assertRuntimeCoverage(runtimeManifest.assets.map(({ id }) => id), manifest.assets.map(({ id }) => id));
        return manifest;
    }
    catch (error) {
        if (error instanceof SupplyChainError)
            throw error;
        invalid("Invalid supply-chain manifest");
    }
}
function groupNoticeAssets(assets) {
    const groups = new Map();
    for (const asset of assets) {
        const key = JSON.stringify([
            asset.canonicalRepository, asset.revision, asset.license, asset.attribution,
            asset.distribution, asset.licenseFiles, asset.citations,
        ]);
        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, { ...asset, ids: [asset.id], sourcePaths: [asset.sourcePath] });
        }
        else {
            group.ids.push(asset.id);
            group.sourcePaths.push(asset.sourcePath);
        }
    }
    return [...groups.values()];
}
function fileList(paths) {
    return paths.map((path) => `\`${path}\``).join(", ");
}
function citationLines(citations) {
    return citations.length === 0 ? [] : [
        "- Citations:",
        ...citations.map((citation) => `  - ${citation}`),
    ];
}
function sourceLabel(repository) {
    const url = new URL(repository);
    return `${url.hostname}${url.pathname}`.replace(/\/$/u, "");
}
function licenseLink(license) {
    const links = {
        "Apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0.txt",
        "BSD-2-Clause": "https://opensource.org/license/bsd-2-clause",
        "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/legalcode",
        MIT: "https://opensource.org/license/mit",
    };
    return license.split(" AND ").map((identifier) => {
        const url = links[identifier];
        return url === undefined ? `\`${identifier}\`` : `[\`${identifier}\`](${url})`;
    }).join(" AND ");
}
function renderNoticeGroup(group) {
    return [
        `## ${sourceLabel(group.canonicalRepository)} — ${group.ids.join(", ")}`,
        "",
        `- Fixed source: [repository](${group.canonicalRepository}) at \`${group.revision}\`.`,
        `- Source files: ${group.sourcePaths.map((path) => `\`${path}\``).join(", ")}.`,
        `- License: ${licenseLink(group.license)}.`,
        ...(group.licenseFiles.length === 0 ? [] :
            [`- License material: ${fileList(group.licenseFiles)}.`]),
        `- Distribution: \`${group.distribution}\`.`,
        `- Attribution: ${group.attribution}`,
        ...citationLines(group.citations),
        "",
    ].join("\n");
}
function renderDependency(dependency) {
    const artifacts = fileList(dependency.artifacts.map(({ path }) => path));
    const notices = fileList(dependency.noticeFiles.map(({ deliveryPath }) => deliveryPath));
    return [
        `## ${dependency.packageName}@${dependency.version}`,
        "",
        `- Fixed source: [repository](${dependency.canonicalRepository}) at \`${dependency.revision}\`.`,
        `- npm integrity: \`${dependency.integrity}\`.`,
        `- License: ${licenseLink(dependency.license)}.`,
        `- License material: ${fileList(dependency.licenseFiles)}.`,
        `- Runtime artifacts: ${artifacts}.`,
        `- Packaged upstream notice inputs: ${notices}.`,
        `- Attribution: ${dependency.attribution}`,
        ...citationLines(dependency.citations),
        "",
    ].join("\n");
}
export function renderThirdPartyNotices(manifest) {
    const header = [
        "# Third-party notices",
        "",
        "> Generated from `src/assets/supply-chain.json`; do not edit independently.",
        "> Transport mirrors are intentionally excluded: they are not provenance or authorship.",
        "",
        "The project itself is licensed under Apache-2.0; the full text is in `LICENSE`.",
        "",
    ].join("\n");
    const assets = groupNoticeAssets(manifest.assets).map(renderNoticeGroup).join("\n");
    const recording = [
        "## Bitbook recording capture",
        "",
        "- Fixed source: [repository](https://github.com/kunji163/clerki) at `44887f62f7b1a69fcc9d23583aa8df8f11898aca`, `audio-native/`.",
        "- License: BSD-2-Clause; full text in `third_party/licenses/BSD-2-Clause-Bitbook.txt`.",
        "- Attribution: Bitbook capture sources, Copyright (c) 2024 Max Bain; project changes cover chunk finalization, format conversion and product naming.",
        "- The Helper wrapper is project-owned Apache-2.0 code. Apple frameworks are linked from macOS, not redistributed.",
        "",
    ].join("\n");
    return `${header}\n${assets}\n${renderDependency(manifest.dependencies[0])}\n${recording}`;
}
//# sourceMappingURL=supply-chain.js.map