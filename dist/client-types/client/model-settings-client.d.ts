import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
export declare function readModelStatus(rpc: ClientConnectionRpc, signal?: AbortSignal): Promise<ModelSettingsStatus>;
