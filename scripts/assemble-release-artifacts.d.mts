export declare const RELEASE_VERSION_PATTERN: RegExp;

export declare function releaseArtifactFiles(root: string): Promise<string[]>;

export declare function assembleReleaseArtifacts(options: {
  root: string;
  out: string;
  version: string;
}): Promise<number>;
