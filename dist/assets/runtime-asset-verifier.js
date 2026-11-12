import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { RuntimeAssetsError } from "./runtime-assets-error.js";
import { assertAssetPathDirectories, AssetVerificationError, mapAssetPathError, resolveAssetPath, } from "./verify-assets.js";
export function currentRuntime() {
    return {
        platform: process.platform,
        architecture: process.arch,
        nodeMajor: Number(process.versions.node.split(".")[0]),
        napi: Number(process.versions.napi),
    };
}
function assertNotAborted(signal) {
    if (signal?.aborted === true) {
        throw new RuntimeAssetsError("STAGE_ABORTED", "Model validation was cancelled");
    }
}
async function sha256Handle(handle, byteLength, signal) {
    const hash = createHash("sha256");
    let position = 0;
    while (position < byteLength) {
        assertNotAborted(signal);
        const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, byteLength - position));
        const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, position);
        assertNotAborted(signal);
        if (bytesRead === 0)
            break;
        hash.update(chunk.subarray(0, bytesRead));
        position += bytesRead;
    }
    assertNotAborted(signal);
    if (position !== byteLength) {
        throw new RuntimeAssetsError("MODEL_NOT_READY", "Runtime asset changed during validation");
    }
    return hash.digest("hex");
}
export async function inspectRegularFile(path, signal) {
    assertNotAborted(signal);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const file = await handle.stat();
        if (!file.isFile()) {
            throw new RuntimeAssetsError("MODEL_NOT_READY", "Runtime asset is not a regular file");
        }
        return { byteLength: file.size, sha256: await sha256Handle(handle, file.size, signal) };
    }
    finally {
        await handle.close();
    }
}
function assertRuntime(asset, actual) {
    const expected = asset.runtime;
    if (expected !== undefined &&
        (expected.platform !== actual.platform || expected.architecture !== actual.architecture ||
            expected.nodeMajor !== actual.nodeMajor || expected.napi !== actual.napi)) {
        throw new AssetVerificationError("RUNTIME_MISMATCH", `Asset runtime mismatch: ${asset.id}`, asset.id);
    }
}
export async function verifyAssetAtRoot(root, asset, runtime, signal) {
    assertNotAborted(signal);
    assertRuntime(asset, runtime);
    const path = resolveAssetPath(root, asset);
    await assertAssetPathDirectories(root, asset);
    let file;
    try {
        file = await inspectRegularFile(path, signal);
    }
    catch (error) {
        const mapped = mapAssetPathError(error, asset.id);
        if (mapped !== undefined)
            throw mapped;
        throw error;
    }
    if (file.byteLength !== asset.byteLength) {
        throw new AssetVerificationError("ASSET_SIZE_MISMATCH", `Asset size mismatch: ${asset.id}`, asset.id);
    }
    if (file.sha256 !== asset.sha256) {
        throw new AssetVerificationError("ASSET_HASH_MISMATCH", `Asset hash mismatch: ${asset.id}`, asset.id);
    }
}
//# sourceMappingURL=runtime-asset-verifier.js.map