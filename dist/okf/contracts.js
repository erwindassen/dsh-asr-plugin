/**
 * Shared vocabulary for Open Knowledge Format (OKF) ingestion.
 *
 * Every module under `src/okf` implements one slice of this contract. The file
 * holds data shapes, ports and error codes only: no behaviour, no imports from
 * sibling modules, so the slices stay independently replaceable.
 */
export class OkfError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = "OkfError";
        this.code = code;
    }
}
//# sourceMappingURL=contracts.js.map