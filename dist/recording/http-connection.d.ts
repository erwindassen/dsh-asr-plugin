import { type HostConnectionHandle } from "@deepseek-ai/dsh-client-connection";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RecordingRpcConnection } from "./host-rpc.js";
type Connection = Pick<HostConnectionHandle, "requestRejection">;
export interface RecordingWebServer {
    register(route: {
        kind: "exact";
        path: string;
        handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
    }): () => void;
}
export declare function recordingHttpConnection(connection: Connection, webServer: RecordingWebServer): RecordingRpcConnection;
export {};
