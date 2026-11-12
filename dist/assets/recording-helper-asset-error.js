export class RecordingHelperAssetError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "RecordingHelperAssetError";
        this.code = code;
    }
}
//# sourceMappingURL=recording-helper-asset-error.js.map