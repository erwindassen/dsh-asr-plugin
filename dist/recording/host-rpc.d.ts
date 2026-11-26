import type { ModelDownloadControl } from "../assets/model-download-contract.js";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
import type { RecordingPermissionControl } from "./permission-contract.js";
import type { TranscriptExportControl } from "../transcripts/transcript-export-contract.js";
import type { AudioDeviceService } from "./audio-devices.js";
import type { MeetingApplication } from "../application/meeting-application.js";
import { type OkfIngestRpcValue, type RecordingRpcResult, type StoredMeetingRpcEntry, type StoredMeetingTranscriptRpcValue } from "./rpc-contract.js";
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
/** Committed meetings and transcripts the recording panel can reopen. */
export interface StoredMeetingSource {
    list(limit: number): readonly StoredMeetingRpcEntry[];
    /**
     * The committed snapshot, or `null` when no such meeting exists. A meeting
     * that exists without a committed transcript is reported as an error, like
     * transcript export does.
     */
    transcript(meetingId: string): StoredMeetingTranscriptRpcValue | null;
}
/** Host control for one meeting's OKF ingestion attempts. */
export interface OkfIngestionControl {
    start(meetingId: string, options: {
        readonly force: boolean;
    }): Promise<OkfIngestRpcValue>;
    status(meetingId: string): OkfIngestRpcValue;
}
/**
 * Panel reads and controls layered over prepared storage. Both halves are
 * optional as a pair: without them the panel endpoints stay unknown.
 */
export interface RecordingPanelPorts {
    readonly meetings: StoredMeetingSource;
    readonly ingestion: OkfIngestionControl;
}
export declare function registerRecordingHostRpc(connection: RecordingRpcConnection, application: MeetingApplication, modelStatus?: (signal: AbortSignal) => Promise<ModelSettingsStatus>, downloads?: ModelDownloadControl, permissions?: RecordingPermissionControl, prepareModels?: (signal: AbortSignal) => Promise<void>, transcripts?: TranscriptExportControl, devices?: AudioDeviceService, chooseOkfDirectory?: (signal?: AbortSignal) => Promise<string | null>, speakerNames?: SpeakerNameStore, panel?: RecordingPanelPorts): () => Promise<void>;
export {};
