export class FunAsrError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "FunAsrError";
        this.code = code;
    }
}
//# sourceMappingURL=errors.js.map