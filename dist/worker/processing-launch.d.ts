import type { ProcessingIdentity } from "../assets/processing-identity.js";
export interface ProcessingLaunch {
    readonly identity: ProcessingIdentity;
    readonly punctuationRoot: string | null;
}
export declare function parseProcessingLaunch(input: string): ProcessingLaunch;
