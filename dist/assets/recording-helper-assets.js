import { lstat, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { RecordingHelperAssetError, } from "./recording-helper-asset-error.js";
import { compareRecordingHelperPaths, MAX_RECORDING_HELPER_FILES, readRecordingHelperManifest, RECORDING_HELPER_BUNDLE_IDENTIFIER, RECORDING_HELPER_COMPONENTS, RECORDING_HELPER_DEVELOPER_IDENTITY, RECORDING_HELPER_TEAM_IDENTIFIER, recordingHelperTreeFingerprint, } from "./recording-helper-manifest.js";
import { inspectRegularFile } from "./runtime-asset-verifier.js";
export { RecordingHelperAssetError } from "./recording-helper-asset-error.js";
function exactJSON(value, expected) {
    return JSON.stringify(value) === JSON.stringify(expected);
}
function componentPaths() {
    return Object.values(RECORDING_HELPER_COMPONENTS).map(({ relativePath }) => relativePath);
}
function expectedComponentEntitlements(relativePath) {
    return relativePath === RECORDING_HELPER_COMPONENTS.systemAudio.relativePath
        ? []
        : ["com.apple.security.device.audio-input"];
}
async function collectAppFiles(appRoot, current = appRoot) {
    const entries = await readdir(current, { withFileTypes: true });
    const files = [];
    for (const entry of entries.sort((left, right) => compareRecordingHelperPaths(left.name, right.name))) {
        const path = join(current, entry.name);
        if (entry.isSymbolicLink()) {
            throw new RecordingHelperAssetError("HELPER_ASSET_INVALID", "Recording helper contains a symbolic link");
        }
        if (entry.isDirectory())
            files.push(...await collectAppFiles(appRoot, path));
        else if (entry.isFile())
            files.push(relative(appRoot, path));
        else {
            throw new RecordingHelperAssetError("HELPER_ASSET_INVALID", "Recording helper contains an unsupported file");
        }
        if (files.length > MAX_RECORDING_HELPER_FILES) {
            throw new RecordingHelperAssetError("HELPER_TREE_MISMATCH", "Recording helper contains too many files");
        }
    }
    return files;
}
async function verifyAppTree(appRootInput, manifest) {
    const appRoot = resolve(appRootInput);
    try {
        const metadata = await lstat(appRoot);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
            throw new RecordingHelperAssetError("HELPER_ASSET_INVALID", "Recording helper root is invalid");
        }
        const actualPaths = (await collectAppFiles(appRoot)).sort(compareRecordingHelperPaths);
        const expectedPaths = manifest.files.map(({ relativePath }) => relativePath);
        if (!exactJSON(actualPaths, expectedPaths)) {
            throw new RecordingHelperAssetError("HELPER_TREE_MISMATCH", "Recording helper tree does not match its manifest");
        }
        const actualFiles = [];
        for (const expected of manifest.files) {
            const actual = await inspectRegularFile(join(appRoot, expected.relativePath));
            if (actual.byteLength !== expected.byteLength || actual.sha256 !== expected.sha256) {
                throw new RecordingHelperAssetError("HELPER_HASH_MISMATCH", "Recording helper file does not match its manifest");
            }
            actualFiles.push({ ...actual, relativePath: expected.relativePath });
        }
        if (recordingHelperTreeFingerprint(actualFiles) !== manifest.treeSha256) {
            throw new RecordingHelperAssetError("HELPER_HASH_MISMATCH", "Recording helper tree hash does not match its manifest");
        }
    }
    catch (error) {
        if (error instanceof RecordingHelperAssetError)
            throw error;
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            throw new RecordingHelperAssetError("HELPER_ASSET_MISSING", "Recording helper is missing");
        }
        throw new RecordingHelperAssetError("HELPER_ASSET_INVALID", "Recording helper could not be verified");
    }
}
function verifySignatureFacts(manifest, facts) {
    const expectedPaths = componentPaths();
    const actualPaths = facts.components.map(({ relativePath }) => relativePath);
    if (!facts.deepValid || !facts.app.valid || facts.components.some(({ valid }) => !valid) ||
        !exactJSON(actualPaths, expectedPaths)) {
        throw new RecordingHelperAssetError("HELPER_SIGNATURE_INVALID", "Recording helper nested signature is invalid");
    }
    const developerID = manifest.product.signingMode === "developer-id";
    const identityMatches = facts.app.bundleIdentifier === manifest.product.bundleIdentifier &&
        facts.app.adHoc === !developerID &&
        facts.app.signingIdentity === (developerID ? RECORDING_HELPER_DEVELOPER_IDENTITY : null) &&
        facts.app.teamIdentifier === (developerID ? RECORDING_HELPER_TEAM_IDENTIFIER : null) &&
        (!developerID || facts.app.designatedRequirement === manifest.product.designatedRequirement) &&
        exactJSON(facts.app.entitlements, manifest.product.entitlements.app) &&
        facts.app.hardenedRuntime && facts.components.every((component) => component.adHoc === !developerID &&
        component.signingIdentity === (developerID ? RECORDING_HELPER_DEVELOPER_IDENTITY : null) &&
        component.teamIdentifier === (developerID ? RECORDING_HELPER_TEAM_IDENTIFIER : null) &&
        component.hardenedRuntime &&
        exactJSON(component.entitlements, expectedComponentEntitlements(component.relativePath)));
    if (!identityMatches) {
        throw new RecordingHelperAssetError("HELPER_SIGNATURE_IDENTITY_MISMATCH", "Recording helper signature identity does not match its manifest");
    }
}
function assertRuntime() {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
        throw new RecordingHelperAssetError("HELPER_RUNTIME_MISMATCH", "Recording helper requires Apple Silicon macOS");
    }
}
async function inspectAndVerifySignature(input, manifest) {
    if (manifest.product.signingMode === "ad-hoc" &&
        manifest.product.distribution !== "public") {
        throw new RecordingHelperAssetError("HELPER_ADHOC_ONLY", "Ad-hoc recording helper cannot pass the product permission gate");
    }
    let facts;
    try {
        facts = await input.inspectSignature({
            appRoot: resolve(input.appRoot),
            componentPaths: componentPaths(),
        });
    }
    catch {
        throw new RecordingHelperAssetError("HELPER_SIGNATURE_INSPECTION_FAILED", "Recording helper signature could not be inspected");
    }
    verifySignatureFacts(manifest, facts);
}
export async function verifyRecordingHelperAssets(input) {
    assertRuntime();
    const { manifest, sha256 } = await readRecordingHelperManifest(resolve(input.manifestPath));
    await verifyAppTree(input.appRoot, manifest);
    await inspectAndVerifySignature(input, manifest);
    return {
        appRoot: resolve(input.appRoot),
        bundleIdentifier: RECORDING_HELPER_BUNDLE_IDENTIFIER,
        componentPaths: componentPaths(),
        manifestSha256: sha256,
        signingMode: manifest.product.signingMode,
        teamIdentifier: manifest.product.teamIdentifier,
    };
}
function actionFor(error) {
    return error.code === "HELPER_RUNTIME_MISMATCH"
        ? "use_compatible_runtime"
        : "rebuild_or_reinstall_helper";
}
function failureReport(error, signingMode) {
    const signatureFailure = error.code.startsWith("HELPER_SIGNATURE_") ||
        error.code === "HELPER_ADHOC_ONLY";
    const id = signatureFailure ? "recording-helper-signature" : "recording-helper-app-tree";
    return {
        ready: false,
        signingMode,
        checks: [{
                id,
                status: "error",
                hashStatus: error.code === "HELPER_HASH_MISMATCH" ? "hash_mismatch" : "not_checked",
            }],
        issues: [{ id, code: error.code, action: actionFor(error) }],
    };
}
export async function doctorRecordingHelper(input) {
    let signingMode = null;
    try {
        assertRuntime();
        const { manifest } = await readRecordingHelperManifest(resolve(input.manifestPath));
        signingMode = manifest.product.signingMode;
        await verifyAppTree(input.appRoot, manifest);
        await inspectAndVerifySignature(input, manifest);
        return {
            ready: true,
            signingMode,
            checks: [
                { id: "recording-helper-app-tree", status: "ok", hashStatus: "ok" },
                { id: "recording-helper-signature", status: "ok", hashStatus: "not_checked" },
            ],
            issues: [],
        };
    }
    catch (error) {
        return failureReport(error instanceof RecordingHelperAssetError ? error :
            new RecordingHelperAssetError("HELPER_ASSET_INVALID", "Recording helper could not be verified"), signingMode);
    }
}
export function packagedRecordingHelperLayout(packageRoot) {
    const root = join(resolve(packageRoot), "dist", "recording-helper");
    return {
        appRoot: join(root, "DSHASRRecordingHelper.app"),
        manifestPath: join(root, "manifest.json"),
    };
}
//# sourceMappingURL=recording-helper-assets.js.map