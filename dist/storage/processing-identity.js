import { parseProcessingIdentity } from "../assets/processing-identity.js";
import { MeetingRepositoryError } from "./errors.js";
export function encodeProcessingIdentity(identity) {
    if (identity === undefined)
        return null;
    try {
        return JSON.stringify(parseProcessingIdentity(identity));
    }
    catch {
        throw new MeetingRepositoryError("INVALID_INPUT", "Processing identity is invalid");
    }
}
export function decodeProcessingIdentity(value) {
    if (value === null)
        return null;
    if (typeof value !== "string" || value.length > 1_024)
        throw new Error("Invalid stored processing identity");
    return parseProcessingIdentity(JSON.parse(value));
}
//# sourceMappingURL=processing-identity.js.map