import { createProcessingIdentity } from "../assets/processing-identity.js";
import { isPunctuationAsset } from "../assets/model-pack.js";
import { fingerprintAssetManifest, readAssetManifest, verifyAssetsAtRoots, } from "../assets/verify-assets.js";
import { WorkerRuntimeError } from "./worker-errors.js";
export async function loadWorkerAssets(config, requiredIds) {
    let engineFingerprint = await fingerprintAssetManifest(config.manifestPath);
    const processing = config.processing;
    if (processing !== undefined) {
        const expected = createProcessingIdentity(await readAssetManifest(config.manifestPath), engineFingerprint, processing.identity.mode, processing.identity.engine);
        if (Object.entries(expected).some(([key, value]) => processing.identity[key] !== value)) {
            throw new WorkerRuntimeError("ASSET_MISMATCH", "Worker processing identity changed");
        }
        engineFingerprint = expected.engineFingerprint;
    }
    const paths = await verifyAssetsAtRoots({
        assetIds: processing?.identity.mode === "base"
            ? requiredIds.filter((id) => !isPunctuationAsset({ id })) : requiredIds,
        ...(processing?.punctuationRoot == null ? {} : { punctuationRoot: processing.punctuationRoot }),
        modelRoot: config.modelRoot,
        packagedNativeRoot: config.packagedNativeRoot,
        manifestPath: config.manifestPath,
    });
    return { engineFingerprint, paths };
}
export function requiredAsset(assets, id) {
    const path = assets[id];
    if (path === undefined) {
        throw new WorkerRuntimeError("ASSET_MISMATCH", "Required Worker asset is missing");
    }
    return path;
}
//# sourceMappingURL=worker-assets.js.map