export declare const RECORDING_HELPER_BUNDLE_IDENTIFIER = "com.bitbook.dsh-asr.recording-helper";
export declare const RECORDING_HELPER_TEAM_IDENTIFIER = "EXAMPLE123";
export declare const RECORDING_HELPER_DEVELOPER_IDENTITY = "Developer ID Application: Example Publisher (EXAMPLE123)";
export declare const RECORDING_HELPER_DESIGNATED_REQUIREMENT: string;
declare const SOURCE_REVISION = "44887f62f7b1a69fcc9d23583aa8df8f11898aca";
export declare const MAX_RECORDING_HELPER_FILES = 256;
export declare const MAX_RECORDING_HELPER_BYTES: number;
export declare const RECORDING_HELPER_COMPONENTS: {
    readonly helper: {
        readonly minimumOS: "13.5";
        readonly relativePath: "Contents/MacOS/DSHASRRecordingHelper";
    };
    readonly microphone: {
        readonly minimumOS: "13.5";
        readonly relativePath: "Contents/Helpers/dsh-asr-capture-mic";
    };
    readonly systemAudio: {
        readonly minimumOS: "14.2";
        readonly relativePath: "Contents/Helpers/dsh-asr-capture-system";
    };
};
export type RecordingHelperSigningMode = "ad-hoc" | "developer-id";
export interface RecordingHelperFile {
    readonly byteLength: number;
    readonly relativePath: string;
    readonly sha256: string;
}
export interface RecordingHelperManifest {
    readonly components: typeof RECORDING_HELPER_COMPONENTS;
    readonly files: readonly RecordingHelperFile[];
    readonly product: {
        readonly architecture: "arm64";
        readonly bundleIdentifier: typeof RECORDING_HELPER_BUNDLE_IDENTIFIER;
        readonly designatedRequirement: string | null;
        readonly distribution: "closed-pilot-only" | "public";
        readonly entitlements: {
            readonly app: readonly ["com.apple.security.device.audio-input"];
            readonly microphone: readonly ["com.apple.security.device.audio-input"];
            readonly systemAudio: readonly [];
        };
        readonly hardenedRuntime: true;
        readonly minimumOS: "13.5";
        readonly notarization: "not-verified";
        readonly permissionProbeEligible: boolean;
        readonly signingIdentity: string | null;
        readonly signingMode: RecordingHelperSigningMode;
        readonly systemAudioMinimumOS: "14.2";
        readonly teamIdentifier: string | null;
    };
    readonly schemaVersion: 1;
    readonly source: {
        readonly historicalRepository: "https://github.com/kunji163/clerki.git";
        readonly license: "BSD-2-Clause";
        readonly project: "Bitbook";
        readonly revision: typeof SOURCE_REVISION;
        readonly sourcePath: "audio-native/";
    };
    readonly treeSha256: string;
}
export declare function compareRecordingHelperPaths(left: string, right: string): number;
export declare function recordingHelperTreeFingerprint(files: readonly RecordingHelperFile[]): string;
export declare function readRecordingHelperManifest(path: string): Promise<{
    readonly manifest: RecordingHelperManifest;
    readonly sha256: string;
}>;
export {};
