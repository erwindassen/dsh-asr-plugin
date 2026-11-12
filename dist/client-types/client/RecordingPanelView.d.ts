import type { RecordingRpcControlPayload, RecordingRpcSegment, RecordingRpcView } from "../recording/rpc-contract.js";
import type { RecordingPendingAction, Translate } from "./RecordingPanel.js";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
export interface PanelViewProps {
    readonly prepare?: (signal: AbortSignal) => Promise<void>;
    readonly hasRecordingHistory: boolean;
    readonly failure: string | null;
    readonly join: () => Promise<void>;
    readonly pending: boolean;
    readonly pendingAction: RecordingPendingAction;
    readonly preview: readonly RecordingRpcSegment[];
    readonly run: (payload: RecordingRpcControlPayload) => Promise<void>;
    readonly settings?: ConfigForm<Record<string, unknown>> | undefined;
    readonly translate: Translate;
    readonly view: RecordingRpcView | null;
}
export declare function RecordingPanelView(props: PanelViewProps): import("react/jsx-runtime").JSX.Element;
