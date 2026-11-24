import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import type { RecordingRpcControlPayload, RecordingRpcSegment, RecordingRpcView } from "../recording/rpc-contract.js";
import type { MeetingReferenceLocaleKey } from "./meeting-reference-locales.js";
import { type SpeakerNameMap } from "../transcripts/speaker-attribution.js";
import { RecordingRpcClient } from "./recording-rpc-client.js";
export type RecordingPendingAction = RecordingRpcControlPayload["action"] | "export" | "join" | null;
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
    readonly settings?: ConfigForm<Record<string, unknown>>;
    readonly translate: Translate;
}
export interface SpeakerAttributionFailure {
    readonly action: "load" | "save";
    readonly code: string;
}
export interface SpeakerAttribution {
    readonly labels: readonly string[];
    readonly names: SpeakerNameMap;
    readonly saving: boolean;
    readonly failure: SpeakerAttributionFailure | null;
    readonly update: (label: string, name: string) => void;
}
interface SpeakerAttributionOptions {
    readonly client: RecordingRpcClient;
    readonly labels: readonly string[];
    readonly meetingId: string | null;
    readonly mounted: React.RefObject<boolean>;
}
/** Distinct speaker labels of the visible draft, in first-appearance order. */
export declare function speakerLabels(preview: readonly RecordingRpcSegment[]): readonly string[];
/**
 * Keeps the names typed for the current draft in sync with the stored
 * attribution: loads on a new meeting or new labels and saves edits after a
 * short pause, so typing does not produce one request per keystroke.
 */
export declare function useSpeakerAttribution(options: SpeakerAttributionOptions): SpeakerAttribution;
interface TranscriptExportOptions {
    readonly client: RecordingRpcClient;
    readonly labels: readonly string[];
    readonly mounted: React.RefObject<boolean>;
    readonly setError: (value: string | null) => void;
    readonly setNotice: (value: string | null) => void;
    readonly setPending: (value: RecordingPendingAction) => void;
    readonly settings: ConfigForm<Record<string, unknown>> | undefined;
    readonly speakerNames: SpeakerNameMap;
    readonly translate: Translate;
    readonly view: RecordingRpcView | null;
}
/**
 * Exports the committed Markdown transcript. The configured folder is used by
 * default; modifier-click asks for a folder and remembers it, so the first
 * export also configures the plugin setting. Renamed speakers are sent along,
 * and an untouched map leaves the payload exactly as before.
 */
export declare function useTranscriptExport(options: TranscriptExportOptions): (choose: boolean) => Promise<void>;
export declare function RecordingPanel(props: RecordingPanelProps): import("react/jsx-runtime").JSX.Element;
export {};
