export class ManagedAudioError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "ManagedAudioError";
    }
}
//# sourceMappingURL=managed-audio-error.js.map