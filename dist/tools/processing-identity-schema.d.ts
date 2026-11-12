import type { ProcessingIdentity } from "../assets/processing-identity.js";
export declare const PROCESSING_IDENTITY_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly mode: {
            readonly type: "string";
            readonly enum: readonly ["base", "enhanced"];
            readonly required: true;
        };
        readonly base_model_fingerprint: {
            readonly type: "string";
            readonly required: true;
        };
        readonly punctuation_model_fingerprint: {
            readonly oneOf: readonly [{
                readonly type: "string";
            }, {
                readonly type: "null";
            }];
            readonly required: true;
        };
        readonly compatibility_fingerprint: {
            readonly type: "string";
            readonly required: true;
        };
        readonly engine_fingerprint: {
            readonly type: "string";
            readonly required: true;
        };
    };
};
export declare function processingIdentityValue(identity: ProcessingIdentity): {
    mode: import("../assets/processing-identity-types.js").ProcessingMode;
    base_model_fingerprint: string;
    punctuation_model_fingerprint: string | null;
    compatibility_fingerprint: string;
    engine_fingerprint: string;
};
