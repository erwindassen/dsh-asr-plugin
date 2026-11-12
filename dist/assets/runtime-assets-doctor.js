import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { currentRuntime, verifyAssetAtRoot, } from "./runtime-asset-verifier.js";
import { readSupplyChainManifest, SupplyChainError } from "./supply-chain.js";
import { AssetVerificationError } from "./verify-assets.js";
import { isParakeetAsset, isPunctuationAsset, modelPackFingerprint } from "./model-pack.js";
function verificationHashStatus(error) {
    if (error.code === "ASSET_MISSING")
        return "missing";
    if (error.code === "ASSET_SIZE_MISMATCH")
        return "size_mismatch";
    if (error.code === "ASSET_HASH_MISMATCH")
        return "hash_mismatch";
    return "not_checked";
}
function recoveryAction(kind, error) {
    if (error.code === "RUNTIME_MISMATCH")
        return "use_compatible_runtime";
    if (kind === "native")
        return "reinstall_plugin";
    if (kind === "dependency")
        return "reinstall_dependency";
    return "restage_model_pack";
}
async function doctorAsset(root, asset, runtime) {
    try {
        await verifyAssetAtRoot(root, asset, runtime);
        return { check: { id: asset.id, kind: asset.kind, status: "ok", hashStatus: "ok" } };
    }
    catch (error) {
        const verification = error instanceof AssetVerificationError
            ? error
            : new AssetVerificationError("ASSET_PATH_INVALID", "Runtime asset is invalid", asset.id);
        return {
            check: {
                id: asset.id,
                kind: asset.kind,
                status: "error",
                hashStatus: verificationHashStatus(verification),
            },
            issue: {
                id: asset.id,
                code: verification.code,
                action: recoveryAction(asset.kind, verification),
            },
        };
    }
}
function dependencyRuntimeMatches(dependency, runtime) {
    return dependency.runtime.platform === runtime.platform &&
        dependency.runtime.architecture === runtime.architecture &&
        dependency.runtime.nodeMajor === runtime.nodeMajor &&
        dependency.runtime.verifiedNapi === runtime.napi &&
        dependency.runtime.addonNapi <= runtime.napi;
}
async function readInstalledDependency(packageRoot, packageName) {
    const anchor = join(resolve(packageRoot), "package.json");
    const manifestPath = createRequire(anchor).resolve(`${packageName}/package.json`);
    const packageJson = await open(manifestPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const file = await packageJson.stat();
        if (!file.isFile() || file.size > 1024 * 1024)
            return undefined;
        const value = JSON.parse((await packageJson.readFile()).toString("utf8"));
        if (typeof value !== "object" || value === null || !("name" in value) || !("version" in value) ||
            value.name !== packageName || typeof value.version !== "string")
            return undefined;
        return { root: dirname(manifestPath), version: value.version };
    }
    finally {
        await packageJson.close();
    }
}
function dependencyError(code, hashStatus) {
    return {
        check: { id: "onnxruntime-node", kind: "dependency", status: "error", hashStatus },
        issue: { id: "onnxruntime-node", code, action: code === "RUNTIME_MISMATCH"
                ? "use_compatible_runtime"
                : "reinstall_dependency" },
    };
}
async function doctorDependency(packageRoot, dependency, runtime) {
    if (!dependencyRuntimeMatches(dependency, runtime)) {
        return dependencyError("RUNTIME_MISMATCH", "not_checked");
    }
    let installed;
    try {
        installed = await readInstalledDependency(packageRoot, dependency.packageName);
    }
    catch {
        return dependencyError("DEPENDENCY_MISSING", "missing");
    }
    if (installed?.version !== dependency.version) {
        return dependencyError("DEPENDENCY_VERSION_MISMATCH", "not_checked");
    }
    for (const artifact of dependency.artifacts) {
        const record = {
            id: dependency.id,
            kind: "native",
            relativePath: artifact.path,
            byteLength: artifact.byteLength,
            sha256: artifact.sha256,
        };
        try {
            await verifyAssetAtRoot(installed.root, record, runtime);
        }
        catch (error) {
            const verification = error instanceof AssetVerificationError
                ? error
                : new AssetVerificationError("ASSET_PATH_INVALID", "Dependency artifact is invalid");
            return dependencyError(verification.code, verificationHashStatus(verification));
        }
    }
    return {
        check: {
            id: dependency.id,
            kind: "dependency",
            status: "ok",
            hashStatus: "ok",
            version: installed.version,
        },
    };
}
function supplyChainFailureReport(layout, runtime, error) {
    return {
        ready: false,
        enhancedReady: false,
        groups: { base: { ready: false, checks: [], issues: [] },
            parakeet: { ready: false, checks: [], issues: [] },
            punctuation: { ready: false, checks: [], issues: [] },
            native: { ready: false, checks: [], issues: [] } },
        modelSetFingerprint: layout.modelSetFingerprint,
        engineFingerprint: layout.engineFingerprint,
        runtime,
        checks: [{
                id: "supply-chain-manifest",
                kind: "package",
                status: "error",
                hashStatus: "not_checked",
            }],
        issues: [{
                id: "supply-chain-manifest",
                code: error.code,
                action: "reinstall_plugin",
            }],
    };
}
async function modelGroupRoot(layout, kind) {
    const splitRoot = join(dirname(layout.modelRoot), modelPackFingerprint(layout.manifest, kind));
    try {
        await lstat(splitRoot);
        return splitRoot;
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return layout.modelRoot;
        }
        return splitRoot;
    }
}
async function doctorGroups(packageRoot, layout, dependency, runtime) {
    const groups = {
        base: { ready: true, checks: [], issues: [] },
        parakeet: { ready: true, checks: [], issues: [] },
        punctuation: { ready: true, checks: [], issues: [] },
        native: { ready: true, checks: [], issues: [] },
    };
    const roots = { base: await modelGroupRoot(layout, "base"),
        parakeet: await modelGroupRoot(layout, "parakeet"),
        punctuation: await modelGroupRoot(layout, "punctuation"), native: layout.packagedNativeRoot };
    for (const asset of layout.manifest.assets) {
        const kind = asset.kind === "native" ? "native" :
            isParakeetAsset(asset) ? "parakeet" :
                isPunctuationAsset(asset) ? "punctuation" : "base";
        const result = await doctorAsset(roots[kind], asset, runtime);
        groups[kind].checks.push(result.check);
        if (result.issue !== undefined)
            groups[kind].issues.push(result.issue);
    }
    const result = await doctorDependency(packageRoot, dependency, runtime);
    groups.native.checks.push(result.check);
    if (result.issue !== undefined)
        groups.native.issues.push(result.issue);
    for (const group of Object.values(groups))
        group.ready = group.issues.length === 0;
    return groups;
}
export async function doctorResolvedRuntimeAssets(input, layout) {
    const runtime = currentRuntime();
    let supplyChain;
    try {
        supplyChain = await readSupplyChainManifest({
            runtimeManifestPath: layout.manifestPath,
            supplyChainPath: join(resolve(input.packageRoot), "dist", "assets", "supply-chain.json"),
        });
    }
    catch (error) {
        if (!(error instanceof SupplyChainError))
            throw error;
        return supplyChainFailureReport(layout, runtime, error);
    }
    const groups = await doctorGroups(input.packageRoot, layout, supplyChain.dependencies[0], runtime);
    const checks = [...groups.base.checks, ...groups.parakeet.checks,
        ...groups.punctuation.checks, ...groups.native.checks];
    const issues = [...groups.base.issues, ...groups.native.issues];
    return {
        ready: issues.length === 0,
        enhancedReady: issues.length === 0 && groups.punctuation.ready,
        groups,
        modelSetFingerprint: layout.modelSetFingerprint,
        engineFingerprint: layout.engineFingerprint,
        runtime,
        checks,
        issues,
    };
}
//# sourceMappingURL=runtime-assets-doctor.js.map