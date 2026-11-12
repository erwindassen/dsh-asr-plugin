const ACTIVE_FIBER_STATE = 2;
/**
 * Cordis 4.1 keeps the raw plugin input on `fiber.config` and publishes the
 * resolved config (volatile accessors included) on `fiber.effectiveConfig`.
 * Older hosts only expose resolved values on `fiber.config`, so read both.
 */
export function effectiveConfig(context) {
    const fiber = context.fiber;
    return (fiber.effectiveConfig ?? fiber.config);
}
/**
 * Volatile fields are `Volatile` refs in a resolved config, but hosts that keep
 * the raw input (or plain schema fields) expose the value directly.
 */
export function readVolatile(value) {
    if (value !== null && typeof value === "object" &&
        typeof value.get === "function") {
        return value.get();
    }
    return value;
}
export function refreshSettingsOnActivation(context) {
    context.on("internal/status", fiber => {
        if (fiber !== context.fiber || fiber.state !== ACTIVE_FIBER_STATE)
            return;
        try {
            context.get("settings")?.describe({ redactSecrets: true });
        }
        catch {
            context.logger("dsh-asr").warn("SETTINGS_REFRESH_FAILED");
        }
    });
}
export function registerConfigUpdates(context, needsRestart) {
    context.on("internal/update", (...update) => {
        const [config] = update;
        if (needsRestart(config)) {
            // Cordis 4.0 passes the no-save flag before the continuation; 4.1 omits it.
            const next = update.length === 3 ? update[2] : update[1];
            return next();
        }
        // Cordis 4.1 publishes the resolved config itself; only older hosts need the swap.
        if (!("effectiveConfig" in context.fiber)) {
            context.fiber.config = config;
        }
    });
}
//# sourceMappingURL=cordis-config.js.map