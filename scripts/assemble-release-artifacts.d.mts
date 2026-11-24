export declare const RELEASE_VERSION_PATTERN: RegExp;

export declare const REQUIRED_RELEASE_PAYLOAD: readonly string[];

export declare function missingReleasePayload(root: string): Promise<string[]>;

export declare function releaseArtifactFiles(root: string): Promise<string[]>;

export declare function assembleReleaseArtifacts(options: {
  root: string;
  out: string;
  version: string;
}): Promise<number>;
