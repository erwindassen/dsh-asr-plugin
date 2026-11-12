import type { ProcessingIdentity } from "../assets/processing-identity.js";
export declare function encodeProcessingIdentity(identity: ProcessingIdentity | undefined): string | null;
export declare function decodeProcessingIdentity(value: unknown): ProcessingIdentity | null;
