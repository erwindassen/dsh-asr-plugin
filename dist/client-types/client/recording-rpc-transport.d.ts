import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
export declare function callRecordingRpc(rpc: ClientConnectionRpc, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<import("@deepseek-ai/dsh-client-connection/client").ConnectionRpcResult<unknown>>;
