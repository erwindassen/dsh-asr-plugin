export class DiarizationError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "DiarizationError";
        this.code = code;
    }
}
//# sourceMappingURL=errors.js.map