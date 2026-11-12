#!/usr/bin/env node
export interface AssetsCliOptions {
    readonly env?: Record<string, string | undefined>;
    readonly packageRoot?: string;
    readonly signal?: AbortSignal;
}
export interface AssetsCliOutcome {
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
}
export declare function runAssetsCli(argv: readonly string[], options?: AssetsCliOptions): Promise<AssetsCliOutcome>;
