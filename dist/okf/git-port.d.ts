import type { Context } from "@deepseek-ai/cordis";
import { type OkfGitPort } from "./contracts.js";
export interface OkfGitPortOptions {
    readonly timeoutMs?: number;
    /** Executable name; overridable so tests can point at a stub. */
    readonly executable?: string;
}
/**
 * Runs git through the subprocess seam with an argv array and no shell, so no
 * value from a transcript, a commit label or a bundle path can be re-parsed as
 * shell syntax. The child environment is the harness-scrubbed parent env.
 *
 * `argv[0]` is the program, matching the subprocess seam; `executable` replaces
 * it so a test can point the port at a stub without changing the call sites.
 */
export declare function createOkfGitPort(context: Context, options?: OkfGitPortOptions): OkfGitPort;
