import type { Context } from "@deepseek-ai/cordis";
/**
 * Cordis 4.1 keeps the raw plugin input on `fiber.config` and publishes the
 * resolved config (volatile accessors included) on `fiber.effectiveConfig`.
 * Older hosts only expose resolved values on `fiber.config`, so read both.
 */
export declare function effectiveConfig<Config>(context: Context): Config;
/**
 * Volatile fields are `Volatile` refs in a resolved config, but hosts that keep
 * the raw input (or plain schema fields) expose the value directly.
 */
export declare function readVolatile<T>(value: unknown): T | undefined;
export declare function refreshSettingsOnActivation(context: Context): void;
export declare function registerConfigUpdates<Config>(context: Context, needsRestart: (config: Config) => boolean): void;
