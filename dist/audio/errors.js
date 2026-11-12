export class AudioReadError extends Error {
    code = "AUDIO_READ_FAILED";
    reason;
    constructor(reason, message, options) {
        super(message, options);
        this.name = "AudioReadError";
        this.reason = reason;
    }
}
//# sourceMappingURL=errors.js.map