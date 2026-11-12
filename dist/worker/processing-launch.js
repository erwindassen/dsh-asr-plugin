import { isAbsolute } from "node:path";
import { parseProcessingIdentity } from "../assets/processing-identity.js";
import { WorkerRuntimeError } from "./worker-errors.js";
export function parseProcessingLaunch(input) {
    try {
        if (input.length > 8_192)
            throw new TypeError("Processing launch is too large");
        const value = JSON.parse(input);
        if (typeof value !== "object" || value === null || Array.isArray(value))
            throw new TypeError();
        const fields = value;
        if (Object.keys(fields).length !== 2 || !Object.hasOwn(fields, "identity") ||
            !Object.hasOwn(fields, "punctuationRoot"))
            throw new TypeError();
        const identity = parseProcessingIdentity(fields.identity);
        const root = fields.punctuationRoot;
        if (identity.mode === "base" ? root !== null
            : typeof root !== "string" || root.length > 4_096 || !isAbsolute(root))
            throw new TypeError();
        return Object.freeze({ identity, punctuationRoot: root });
    }
    catch {
        throw new WorkerRuntimeError("INVALID_REQUEST", "Worker processing launch is invalid");
    }
}
//# sourceMappingURL=processing-launch.js.map