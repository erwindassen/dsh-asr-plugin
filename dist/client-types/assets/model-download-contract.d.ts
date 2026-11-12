export type ModelDownloadPack = "base" | "parakeet" | "punctuation";
export type ModelDownloadPhase = "idle" | "downloading" | "verifying" | "installing" | "completed" | "failed" | "cancelled";
export interface ModelDownloadStatus {
    readonly pack: ModelDownloadPack | null;
    readonly phase: ModelDownloadPhase;
    readonly downloadedBytes: number;
    readonly totalBytes: number;
    readonly jobId: string | null;
    readonly errorCode: string | null;
}
export interface ModelDownloadSettings {
    readonly route: "default" | "direct" | "proxy";
    readonly proxyUrl?: string;
    readonly proxyKind?: "mirror" | "http";
}
export declare function customModelProxy(settings: ModelDownloadSettings): string | undefined;
export declare class ModelDownloadError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function modelProxyUrl(value: string | undefined): string;
export interface ModelDownloadControl {
    status(): ModelDownloadStatus;
    start(pack: ModelDownloadPack): Promise<ModelDownloadStatus>;
    cancel(): Promise<ModelDownloadStatus>;
}
