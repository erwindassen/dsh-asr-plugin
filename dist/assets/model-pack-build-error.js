export class ModelPackBuildError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "ModelPackBuildError";
        this.code = code;
    }
}
export function failModelPackBuildInvalid(message) {
    throw new ModelPackBuildError("MODEL_PACK_BUILD_INVALID", message);
}
export function fileSystemErrorCode(error) {
    return error instanceof Error && "code" in error ? error.code : undefined;
}
//# sourceMappingURL=model-pack-build-error.js.map