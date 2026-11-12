import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import type { ModelSettingsTranslate } from "./model-settings-locales.js";
type Props = {
    source: ConfigForm<Record<string, unknown>>;
    rpc: ClientConnectionRpc;
    t: ModelSettingsTranslate;
};
export declare function ModelSettingsBundle({ source, rpc, t }: Props): import("react/jsx-runtime").JSX.Element;
export {};
