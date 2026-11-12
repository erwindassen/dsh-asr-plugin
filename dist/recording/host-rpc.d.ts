import type { ModelDownloadControl } from "../assets/model-download-contract.js";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
import type { RecordingPermissionControl } from "./permission-contract.js";
import type { MeetingApplication } from "../application/meeting-application.js";
import { type RecordingRpcResult } from "./rpc-contract.js";
type RecordingRpcHandler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RecordingRpcResult>;
export interface RecordingRpcConnection {
    readonly rpc: {
        handle(channel: string, handler: RecordingRpcHandler, options: {
            readonly authority: "loopback";
        }): () => Promise<void>;
    };
}
export declare function registerRecordingHostRpc(connection: RecordingRpcConnection, application: MeetingApplication, modelStatus?: (signal: AbortSignal) => Promise<ModelSettingsStatus>, downloads?: ModelDownloadControl, permissions?: RecordingPermissionControl, prepareModels?: (signal: AbortSignal) => Promise<void>): () => Promise<void>;
export {};
