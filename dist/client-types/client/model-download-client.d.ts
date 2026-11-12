import type { ConfigPageForm } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ModelDownloadPack, ModelDownloadStatus } from "../assets/model-download-contract.js";
export declare function readDownloadStatus(rpc: ClientConnectionRpc, signal?: AbortSignal): Promise<ModelDownloadStatus>;
export declare function saveDownloadSettings(form: ConfigPageForm, route: "default" | "direct" | "proxy", proxy: string, revision: number, kind?: "mirror" | "http"): Promise<"invalid" | "saved" | "conflict">;
export interface DownloadConnectionDraft {
    readonly route: "default" | "direct" | "proxy";
    readonly proxy: string;
    readonly kind: "mirror" | "http";
    readonly revision: number;
}
export declare function startModelDownload(rpc: ClientConnectionRpc, form: ConfigPageForm | undefined, pack: ModelDownloadPack, draft: DownloadConnectionDraft | null, onSaved?: () => void): Promise<"failed" | "invalid" | "conflict" | "started">;
