import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { AsrEngine } from "./assets/processing-identity.js";
export declare const name = "dsh-asr";
export declare const inject: string[];
export interface Config {
    readonly asr_engine?: AsrEngine;
    readonly data_dir?: string;
    readonly punctuation_enabled?: boolean;
    readonly hf_download_route?: "default" | "direct" | "proxy";
    readonly hf_proxy_url?: string;
    readonly hf_proxy_kind?: "mirror" | "http";
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    asr_engine: z<"parakeet" | "paraformer", "parakeet" | "paraformer", "volatile-defined">;
    punctuation_enabled: z<boolean, boolean, "volatile">;
    hf_download_route: z<"default" | "direct" | "proxy", "default" | "direct" | "proxy", "volatile-defined">;
    hf_proxy_url: z<string, string, "volatile-defined">;
    hf_proxy_kind: z<"mirror" | "http", "mirror" | "http", "volatile">;
    data_dir: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    asr_engine: z<"parakeet" | "paraformer", "parakeet" | "paraformer", "volatile-defined">;
    punctuation_enabled: z<boolean, boolean, "volatile">;
    hf_download_route: z<"default" | "direct" | "proxy", "default" | "direct" | "proxy", "volatile-defined">;
    hf_proxy_url: z<string, string, "volatile-defined">;
    hf_proxy_kind: z<"mirror" | "http", "mirror" | "http", "volatile">;
    data_dir: z<string, string, "defined">;
}>>, "plain">;
type ParsedConfig = ReturnType<typeof Config>;
export declare function apply(context: Context, config: ParsedConfig): Promise<void>;
export {};
