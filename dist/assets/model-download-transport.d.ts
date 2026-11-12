import type { SubprocessHandle, SubprocessSpawnSpec } from "@deepseek-ai/dsh-subprocess";
export interface ModelDownloadTransport {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
export interface DownloadFileInput {
    readonly url: string;
    readonly fallbacks?: readonly {
        url: string;
        proxyUrl?: string;
    }[];
    readonly expectedSha256?: string;
    readonly destination: string;
    readonly expectedBytes: number;
    readonly proxyUrl?: string;
    readonly workRoot: string;
    readonly signal: AbortSignal;
    readonly progress: (bytes: number) => void;
}
export declare function downloadModelFile(transport: ModelDownloadTransport, input: DownloadFileInput): Promise<void>;
