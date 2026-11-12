export class NativeAdapterError extends Error {
    code;
    component;
    constructor(code, component, message, options) {
        super(message, options);
        this.name = "NativeAdapterError";
        this.code = code;
        this.component = component;
    }
}
//# sourceMappingURL=errors.js.map