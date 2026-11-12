import type { ConfigPageForm } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
import type { ModelSettingsTranslate } from "./model-settings-locales.js";
type Props = {
    form: ConfigPageForm | undefined;
    rpc: ClientConnectionRpc;
    t: ModelSettingsTranslate;
    models: ModelSettingsStatus | null;
    onInstalled: () => void;
};
export declare function ModelDownloadSettings(props: Props): import("react/jsx-runtime").JSX.Element;
export {};
