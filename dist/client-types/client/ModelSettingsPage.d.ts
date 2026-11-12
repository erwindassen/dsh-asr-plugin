import type { ConfigPageForm } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import type { ModelSettingsStatus } from "../assets/model-settings-contract.js";
import type { ModelSettingsTranslate } from "./model-settings-locales.js";
type Props = {
    form: ConfigPageForm | undefined;
    rpc: ClientConnectionRpc;
    t: ModelSettingsTranslate;
};
export declare function ModelInstructions({ t }: {
    status: ModelSettingsStatus;
    t: ModelSettingsTranslate;
}): import("react/jsx-runtime").JSX.Element;
export declare function ModelSettingsPage({ form, rpc, t }: Props): import("react/jsx-runtime").JSX.Element;
export {};
