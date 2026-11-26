import type { AudioDeviceInventoryRpc, RecordingRpcControlPayload, RecordingRpcSegment, RecordingRpcView } from "../recording/rpc-contract.js";
import type { RecordingPendingAction, SpeakerAttribution, Translate } from "./RecordingPanel.js";
import type { MeetingIngestion, StoredMeetings } from "./use-stored-meetings.js";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
/** A committed transcript is displayed instead of the live draft. */
export interface StoredPreview {
    /** Committed transcript version, or null while it is still loading. */
    readonly version: number | null;
    /** The committed transcript could not be read. */
    readonly failed?: boolean;
}
export interface PanelViewProps {
    readonly attribution?: SpeakerAttribution | undefined;
    readonly exportNotice?: string | null;
    readonly exportTranscript?: (choose: boolean) => Promise<void>;
    readonly prepare?: (signal: AbortSignal) => Promise<void>;
    readonly hasRecordingHistory: boolean;
    readonly failure: string | null;
    readonly canIngest?: boolean;
    readonly ingestion?: MeetingIngestion | undefined;
    readonly stored?: StoredPreview | null | undefined;
    readonly storedMeetings?: StoredMeetings | undefined;
    readonly join: () => Promise<void>;
    readonly pending: boolean;
    readonly pendingAction: RecordingPendingAction;
    readonly preview: readonly RecordingRpcSegment[];
    readonly devices: AudioDeviceInventoryRpc | null;
    readonly refreshDevices: () => Promise<void>;
    readonly run: (payload: RecordingRpcControlPayload) => Promise<void>;
    readonly selectDevice: (track: "mic" | "system", uid: string) => Promise<void>;
    readonly selectedDevices: {
        readonly mic: string;
        readonly system: string;
    };
    readonly settings?: ConfigForm<Record<string, unknown>> | undefined;
    readonly settingsRevision?: number | undefined;
    readonly translate: Translate;
    readonly view: RecordingRpcView | null;
}
export { isRecordingActive } from "./recording-view-state.js";
/**
 * Ingestion is user-driven: it becomes available only for a committed
 * transcript that is currently displayed and only while no recording owns the
 * draft area.
 */
export declare function canIngest(props: Pick<PanelViewProps, "ingestion" | "pending" | "storedMeetings" | "view">): boolean;
export declare function RecordingPanelView(props: PanelViewProps): import("react/jsx-runtime").JSX.Element;
