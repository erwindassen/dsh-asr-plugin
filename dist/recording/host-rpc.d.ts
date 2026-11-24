import type { ModelDownloadControl } from "../assets/model-download-contract.js";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
import type { RecordingPermissionControl } from "./permission-contract.js";
import type { TranscriptExportControl } from "../transcripts/transcript-export-contract.js";
import type { AudioDeviceService } from "./audio-devices.js";
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
/**
 * Per-meeting speaker attribution storage. Declared structurally so the RPC layer
 * does not depend on the SQLite implementation.
 */
export interface SpeakerNameStore {
    list(meetingId: string): readonly {
        readonly label: string;
        readonly name: string;
    }[];
    replace(meetingId: string, names: readonly {
        readonly label: string;
        readonly name: string;
    }[]): void;
}
export declare function registerRecordingHostRpc(connection: RecordingRpcConnection, application: MeetingApplication, modelStatus?: (signal: AbortSignal) => Promise<ModelSettingsStatus>, downloads?: ModelDownloadControl, permissions?: RecordingPermissionControl, prepareModels?: (signal: AbortSignal) => Promise<void>, transcripts?: TranscriptExportControl, devices?: AudioDeviceService, chooseOkfDirectory?: (signal?: AbortSignal) => Promise<string | null>, speakerNames?: SpeakerNameStore): () => Promise<void>;
export {};
