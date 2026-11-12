export function customModelProxy(settings) {
    if (settings.proxyKind === "mirror" || settings.route === "direct" || !settings.proxyUrl?.trim())
        return undefined;
    return modelProxyUrl(settings.proxyUrl);
}
export class ModelDownloadError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
export function modelProxyUrl(value) {
    try {
        if (value === undefined || value.length > 2_048)
            throw new Error();
        const url = new URL(value.trim());
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password ||
            (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash)
            throw new Error();
        return url.href;
    }
    catch {
        throw new ModelDownloadError("MODEL_PROXY_INVALID");
    }
}
//# sourceMappingURL=model-download-contract.js.map