export function parseRecordingPermissions(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("INVALID_RESPONSE");
    const item = value;
    if (Object.keys(item).length !== 2 ||
        typeof item.microphone !== "string" || typeof item.system !== "string" ||
        !["granted", "denied", "restricted", "notDetermined"].includes(item.microphone) ||
        !["verified", "unverified", "unsupported"].includes(item.system))
        throw new Error("INVALID_RESPONSE");
    return item;
}
//# sourceMappingURL=permission-contract.js.map