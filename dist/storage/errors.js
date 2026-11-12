export class MeetingRepositoryError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "MeetingRepositoryError";
    }
}
//# sourceMappingURL=errors.js.map