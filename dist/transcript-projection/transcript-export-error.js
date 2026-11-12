export class TranscriptProjectionError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "TranscriptProjectionError";
    }
}
//# sourceMappingURL=transcript-export-error.js.map