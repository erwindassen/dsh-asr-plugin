import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import type { Translate } from "./RecordingPanel.js";
export type RecognizerEngine = "paraformer" | "parakeet";
interface RecognizerSelectProps {
    readonly revision?: number | undefined;
    readonly settings: ConfigForm<Record<string, unknown>> | undefined;
    readonly translate: Translate;
}
/**
 * Recognizer family switch for the next recording. The choice is the profile
 * `asr_engine` setting, so it stays in step with the plugin settings page, and
 * it is read on every render instead of subscribed so this panel stays a pure
 * view of the recording state.
 */
export declare function RecognizerSelect(props: RecognizerSelectProps): import("react/jsx-runtime").JSX.Element;
export {};
