import type { RuntimeAssetsInput } from "./runtime-assets.js";
import type { ModelSettingsStatus } from "./model-settings-contract.js";
export declare function readModelSettings(input: RuntimeAssetsInput, _legacyPreference?: boolean): Promise<ModelSettingsStatus>;
