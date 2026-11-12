import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { RecordingRpcControlPayload, RecordingRpcView } from "../recording/rpc-contract.js";
import type { MeetingReferenceLocaleKey } from "./meeting-reference-locales.js";
export type RecordingPendingAction = RecordingRpcControlPayload["action"] | "join" | null;
export type Translate = (key: MeetingReferenceLocaleKey, params?: Readonly<Record<string, string>>) => string;
export interface RecordingReferenceActions {
    join(view: RecordingRpcView | null): Promise<void>;
    observeRecording(view: RecordingRpcView | null): void;
    recordingStarted(view: RecordingRpcView, sessionId?: string): Promise<void>;
}
interface LocaleFace {
    getSnapshot(): {
        readonly revision: number;
    };
    subscribe(listener: () => void): () => void;
}
interface RecordingPanelProps {
    readonly currentSessionId: () => string | undefined;
    readonly locale: LocaleFace;
    readonly references: RecordingReferenceActions;
    readonly rpc: ClientConnectionRpc;
    readonly translate: Translate;
}
export declare function RecordingPanel(props: RecordingPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
