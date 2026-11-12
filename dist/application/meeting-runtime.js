import { parseProcessingIdentity } from "../assets/processing-identity.js";
export function freezeMeetingRuntime(runtime) {
    const processingIdentity = parseProcessingIdentity(runtime.processingIdentity);
    if (runtime.engineFingerprint !== processingIdentity.engineFingerprint) {
        throw new TypeError("Meeting runtime identity does not match its engine");
    }
    return Object.freeze({ ...runtime, processingIdentity });
}
//# sourceMappingURL=meeting-runtime.js.map