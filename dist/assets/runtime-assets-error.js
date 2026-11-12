export class RuntimeAssetsError extends Error {
    assetId;
    code;
    constructor(code, message, assetId) {
        super(message);
        this.name = "RuntimeAssetsError";
        this.code = code;
        this.assetId = assetId;
    }
}
//# sourceMappingURL=runtime-assets-error.js.map