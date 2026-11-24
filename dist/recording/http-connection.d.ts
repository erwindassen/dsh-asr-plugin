import { type ConnectionTrustRequest, type PeerAdmission } from "@deepseek-ai/dsh-client-connection";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RecordingRpcConnection } from "./host-rpc.js";
export interface RecordingRpcAdmission {
    admit(request: ConnectionTrustRequest): PeerAdmission;
}
type Connection = RecordingRpcAdmission;
/**
 * DSH 0.2.3 verifies credentials through a `connection.authentication` service
 * that it resolves through the fiber calling `admit`, so the call has to come
 * from a context that injected it. Older series expose no such service and
 * `admit` needs nothing, so the fallback stays the plain connection.
 */
export declare function admittingThrough(preferred: () => RecordingRpcAdmission | undefined, fallback: RecordingRpcAdmission): RecordingRpcAdmission;
export interface RecordingWebServer {
    register(route: {
        kind: "exact";
        path: string;
        handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>;
    }): () => void;
}
export declare function recordingHttpConnection(connection: Connection, webServer: RecordingWebServer): RecordingRpcConnection;
export {};
