import type { RecordingHelperSubprocess } from "./helper-client.js";
import { type RecordingPermissionControl, type RecordingPermissions } from "./permission-contract.js";
type Options = {
    readonly resolveApp: () => Promise<string>;
    readonly subprocess: RecordingHelperSubprocess;
};
export declare class RecordingPermissionsService implements RecordingPermissionControl {
    private readonly options;
    private pending;
    constructor(options: Options);
    read(signal?: AbortSignal): Promise<RecordingPermissions>;
    test(signal?: AbortSignal): Promise<RecordingPermissions>;
    require(signal?: AbortSignal): Promise<void>;
    openSettings(track: "microphone" | "system", signal?: AbortSignal): Promise<void>;
    private run;
    private launch;
}
export {};
