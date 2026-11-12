import type { AssetManifest } from "./verify-assets.js";
import type { AsrEngine, ProcessingIdentity, ProcessingMode } from "./processing-identity-types.js";
export type { AsrEngine, ProcessingIdentity, ProcessingMode } from "./processing-identity-types.js";
export { ASR_ENGINES } from "./processing-identity-types.js";
export declare function createProcessingIdentity(manifest: AssetManifest, manifestFingerprint: string, mode: ProcessingMode, engine?: AsrEngine): ProcessingIdentity;
/**
 * Accepts identities recorded before the engine field existed; those rows were
 * always produced by the Paraformer family.
 */
export declare function parseProcessingIdentity(value: unknown): ProcessingIdentity;
