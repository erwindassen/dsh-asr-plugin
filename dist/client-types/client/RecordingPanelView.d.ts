import type { AudioDeviceInventoryRpc, RecordingRpcControlPayload, RecordingRpcSegment, RecordingRpcView } from "../recording/rpc-contract.js";
import type { RecordingPendingAction, SpeakerAttribution, Translate } from "./RecordingPanel.js";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
export interface PanelViewProps {
    readonly attribution?: SpeakerAttribution | undefined;
    readonly exportNotice?: string | null;
    readonly exportTranscript?: (choose: boolean) => Promise<void>;
    readonly prepare?: (signal: AbortSignal) => Promise<void>;
    readonly hasRecordingHistory: boolean;
    readonly failure: string | null;
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
export declare function RecordingPanelView(props: PanelViewProps): import("react/jsx-runtime").JSX.Element;
