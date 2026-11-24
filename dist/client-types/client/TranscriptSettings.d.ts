import type { ConfigPageForm } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ModelSettingsTranslate } from "./model-settings-locales.js";
interface Props {
    readonly form: ConfigPageForm | undefined;
    readonly rpc: ClientConnectionRpc;
    readonly t: ModelSettingsTranslate;
    /** Host-supplied binding; omitted, the section reads the plugin Config keys. */
    readonly okf?: OkfSettingsBinding;
}
export interface OkfSettingsValues {
    readonly directory: string;
    readonly autoIngest: boolean;
}
/**
 * Persistence surface for the Open knowledge base section. A host that keeps
 * these settings outside the `dsh-asr` Config schema passes its own binding
 * instead of relying on the default `okf_directory` / `okf_ingest` keys.
 */
export interface OkfSettingsBinding {
    readonly directory: string;
    readonly autoIngest: boolean;
    readonly writable: boolean;
    chooseDirectory(): Promise<string | null>;
    save(next: OkfSettingsValues): Promise<boolean>;
}
/**
 * Default folder for exported transcripts and the Open knowledge base section.
 * The macOS chooser runs on the host, so the same dialog is available from the
 * recording panel when no folder is configured yet.
 */
export declare function TranscriptSettings({ form, rpc, t, okf }: Props): import("react/jsx-runtime").JSX.Element;
export {};
