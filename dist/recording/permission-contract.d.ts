export interface RecordingPermissions {
    readonly microphone: "granted" | "denied" | "restricted" | "notDetermined";
    readonly system: "verified" | "unverified" | "unsupported";
}
export interface RecordingPermissionControl {
    read(signal?: AbortSignal): Promise<RecordingPermissions>;
    test(signal?: AbortSignal): Promise<RecordingPermissions>;
    require(signal?: AbortSignal): Promise<void>;
    openSettings(track: "microphone" | "system", signal?: AbortSignal): Promise<void>;
}
export declare function parseRecordingPermissions(value: unknown): RecordingPermissions;
