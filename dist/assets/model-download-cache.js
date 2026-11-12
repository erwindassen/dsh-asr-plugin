import { constants } from "node:fs";
import { copyFile, lstat, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AssetVerificationError, assertAssetPathDirectories, verifyAssetsAtRoots } from "./verify-assets.js";
import { ModelDownloadError } from "./model-download-contract.js";
export async function prepareDownloadCache(dataRoot, pack) {
    const parent = join(dataRoot, ".model-download-cache");
    const root = join(parent, pack);
    for (const directory of [parent, root]) {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const entry = await lstat(directory);
        if (!entry.isDirectory() || entry.isSymbolicLink())
            throw new ModelDownloadError("ASSET_PATH_INVALID");
    }
    return root;
}
export async function restoreDownloadedAsset(root, manifestPath, asset, destination, signal) {
    signal.throwIfAborted();
    try {
        await verifyAssetsAtRoots({ manifestPath, modelRoot: root, packagedNativeRoot: root, assetIds: [asset.id] });
    }
    catch (error) {
        if (!(error instanceof AssetVerificationError) ||
            !["ASSET_MISSING", "ASSET_HASH_MISMATCH", "ASSET_SIZE_MISMATCH"].includes(error.code))
            throw error;
        return false;
    }
    signal.throwIfAborted();
    await copyFile(join(root, asset.relativePath), destination, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
    return true;
}
export async function retainDownloadedAsset(root, asset, source) {
    const destination = join(root, asset.relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await assertAssetPathDirectories(root, asset);
    const temporary = `${destination}.${randomUUID()}`;
    try {
        await copyFile(source, temporary, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
        await rename(temporary, destination);
    }
    finally {
        await rm(temporary, { force: true });
    }
}
//# sourceMappingURL=model-download-cache.js.map