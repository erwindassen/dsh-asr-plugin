import { configuredProcessingMode, resolveProcessingAssets } from "./runtime-mode.js";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { modelSetFingerprint, parseModelPackManifest, } from "./model-pack.js";
import { currentRuntime, inspectRegularFile, verifyAssetAtRoot } from "./runtime-asset-verifier.js";
import { doctorResolvedRuntimeAssets } from "./runtime-assets-doctor.js";
import { RuntimeAssetsError } from "./runtime-assets-error.js";
import { installationState, installVerifiedModels, prepareModelStore, reconcileStaleStageEntries, verifyModelsAtRoot, } from "./runtime-assets-installation.js";
import { acquireModelStageLease } from "./runtime-assets-stage-lease.js";
import { extractStrictTar } from "./strict-tar.js";
import { AssetVerificationError, fingerprintAssetManifest, readAssetManifest, } from "./verify-assets.js";
function manifestPath(packageRoot) {
    return join(resolve(packageRoot), "dist", "assets", "manifest.json");
}
function assertRuntimeAssetRoots(manifest) {
    for (const asset of manifest.assets) {
        const expectedPrefix = asset.kind === "native" ? "native/" : "models/";
        if (!asset.relativePath.startsWith(expectedPrefix)) {
            throw new AssetVerificationError("MANIFEST_INVALID", `Asset is assigned to the wrong runtime root: ${asset.id}`, asset.id);
        }
    }
}
async function runtimeLayout(input) {
    const packagedRoot = join(resolve(input.packageRoot), "dist");
    const path = manifestPath(input.packageRoot);
    const [manifest, engineFingerprint] = await Promise.all([
        readAssetManifest(path),
        fingerprintAssetManifest(path),
    ]);
    assertRuntimeAssetRoots(manifest);
    const fingerprint = modelSetFingerprint(manifest);
    const modelStoreRoot = join(resolve(input.dataRoot), "assets");
    return {
        manifest,
        engineFingerprint,
        manifestPath: path,
        modelRoot: join(modelStoreRoot, fingerprint),
        modelSetFingerprint: fingerprint,
        modelStoreRoot,
        packagedNativeRoot: packagedRoot,
    };
}
function expectedPackFiles(manifest) {
    return [
        ...manifest.assets.map(({ byteLength, relativePath, sha256 }) => ({
            byteLength,
            install: true,
            relativePath,
            sha256,
        })),
        ...manifest.materials.map(({ byteLength, relativePath, sha256 }) => ({
            byteLength,
            install: false,
            relativePath,
            sha256,
        })),
    ];
}
function comparePaths(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
async function collectThirdPartyFiles(packageRoot, relativeDirectory) {
    const directory = join(packageRoot, relativeDirectory);
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT")
            return [];
        throw error;
    }
    const files = [];
    for (const entry of entries.sort((left, right) => comparePaths(left.name, right.name))) {
        const path = join(relativeDirectory, entry.name);
        if (entry.isDirectory())
            files.push(...await collectThirdPartyFiles(packageRoot, path));
        else if (entry.isFile())
            files.push(path);
        else
            throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Package legal material is invalid");
    }
    return files;
}
async function expectedLegalMaterials(packageRoot, split) {
    const paths = [
        "LICENSE",
        "THIRD_PARTY_NOTICES.md",
        ...await collectThirdPartyFiles(packageRoot, "third_party"),
        ...(split ? ["dist/assets/supply-chain.json"] : []),
    ];
    if (paths.length > 64) {
        throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Package has too many legal files");
    }
    return Promise.all(paths.sort(comparePaths).map(async (relativePath) => ({
        relativePath,
        ...await inspectRegularFile(join(packageRoot, relativePath)),
    })));
}
async function assertLegalMaterials(packageRoot, actual, split) {
    const expected = await expectedLegalMaterials(packageRoot, split);
    const sortedActual = [...actual]
        .sort((left, right) => comparePaths(left.relativePath, right.relativePath))
        .map(({ byteLength, relativePath, sha256 }) => ({ relativePath, byteLength, sha256 }));
    if (JSON.stringify(sortedActual) !== JSON.stringify(expected)) {
        throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Model pack legal material does not match the code package");
    }
}
async function verifyRuntimeManifestAssets(layout, signal) {
    const runtime = currentRuntime();
    for (const asset of layout.manifest.assets) {
        const root = asset.kind === "native" ? layout.packagedNativeRoot : layout.modelRoot;
        await verifyAssetAtRoot(root, asset, runtime, signal);
    }
}
function mapStageError(error) {
    if (error instanceof RuntimeAssetsError || error instanceof AssetVerificationError)
        throw error;
    if (error instanceof Error && "code" in error && error.code === "ENOSPC") {
        throw new RuntimeAssetsError("DISK_SPACE_INSUFFICIENT", "Model pack staging needs more disk space");
    }
    if (error instanceof Error && "code" in error &&
        (error.code === "ELOOP" || error.code === "ENOENT")) {
        throw new RuntimeAssetsError("MODEL_PACK_INVALID", "Model pack file is invalid");
    }
    throw error;
}
async function validateModelPack(layout, input, destinationRoot) {
    let packManifest;
    await extractStrictTar({
        archivePath: resolve(input.modelPackPath),
        onManifest(bytes) {
            packManifest = parseModelPackManifest(bytes, layout.manifest);
            return expectedPackFiles(packManifest);
        },
        ...(destinationRoot === undefined ? {} : { destinationRoot }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (packManifest === undefined) {
        throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Model pack is incompatible");
    }
    await assertLegalMaterials(resolve(input.packageRoot), packManifest.materials, packManifest.schemaVersion === 2);
    return packManifest;
}
async function stageWhileLeased(layout, input) {
    await prepareModelStore(layout);
    await reconcileStaleStageEntries(layout.modelStoreRoot);
    const pack = await validateModelPack(layout, input);
    const installation = { ...layout,
        manifest: { ...layout.manifest, assets: pack.assets },
        modelSetFingerprint: pack.modelSetFingerprint,
        modelRoot: join(layout.modelStoreRoot, pack.modelSetFingerprint),
    };
    const previousState = await installationState(installation);
    if (previousState === "ready") {
        return { installed: false, modelSetFingerprint: pack.modelSetFingerprint };
    }
    const temporaryRoot = await mkdtemp(join(layout.modelStoreRoot, `.stage-${randomUUID()}-`));
    await chmod(temporaryRoot, 0o700);
    try {
        const extracted = await validateModelPack(layout, input, temporaryRoot);
        if (JSON.stringify(extracted) !== JSON.stringify(pack)) {
            throw new RuntimeAssetsError("MODEL_PACK_INCOMPATIBLE", "Model pack changed during staging");
        }
        await verifyModelsAtRoot(installation.manifest, temporaryRoot, input.signal);
        const installed = await installVerifiedModels(installation, temporaryRoot, previousState);
        return { installed, modelSetFingerprint: pack.modelSetFingerprint };
    }
    finally {
        await rm(temporaryRoot, { force: true, recursive: true });
    }
}
async function stageModelPackUnchecked(input) {
    const layout = await runtimeLayout(input);
    const lease = await acquireModelStageLease(input.dataRoot, input.signal);
    try {
        return await stageWhileLeased(layout, input);
    }
    finally {
        await lease[Symbol.asyncDispose]();
    }
}
export async function stageModelPack(input) {
    try {
        return await stageModelPackUnchecked(input);
    }
    catch (error) {
        mapStageError(error);
    }
}
export async function resolveRuntimeAssets(input) {
    const layout = await runtimeLayout(input);
    if (input.mode !== undefined) {
        return { ...layout, ...await resolveProcessingAssets(layout, input.mode, input.engine, input.signal) };
    }
    await verifyRuntimeManifestAssets(layout, input.signal);
    return {
        engineFingerprint: layout.engineFingerprint,
        manifestPath: layout.manifestPath,
        modelRoot: layout.modelRoot,
        modelSetFingerprint: layout.modelSetFingerprint,
        packagedNativeRoot: layout.packagedNativeRoot,
    };
}
export async function resolveConfiguredRuntimeAssets(input, _legacyPreference) {
    const lease = await acquireModelStageLease(input.dataRoot, input.signal);
    try {
        const layout = await runtimeLayout(input);
        const mode = await configuredProcessingMode(layout, input.engine, input.signal);
        return { ...layout, ...await resolveProcessingAssets(layout, mode, input.engine, input.signal) };
    }
    finally {
        await lease[Symbol.asyncDispose]();
    }
}
export async function doctorRuntimeAssets(input) {
    const layout = await runtimeLayout(input);
    return doctorResolvedRuntimeAssets(input, layout);
}
export { doctorRecordingHelper, packagedRecordingHelperLayout, verifyRecordingHelperAssets, } from "./recording-helper-assets.js";
//# sourceMappingURL=runtime-assets.js.map