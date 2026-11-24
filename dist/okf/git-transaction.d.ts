/**
 * All-or-nothing OKF ingestion on top of git.
 *
 * POSIX cannot rename a directory of many files atomically, so the bundle is a
 * git repository and one ingestion is exactly one commit. The transaction
 * records a baseline commit, writes `.git/okf-ingestion-journal` before the
 * caller touches the worktree, and either commits the attempt or restores the
 * baseline with `git reset --hard <baseline>` plus `git clean -fd`.
 *
 * Those two commands together are byte-identical to the starting worktree:
 * `reset --hard` rewrites every tracked file and deletes files that were tracked
 * in the baseline, and `clean -fd` removes the untracked files the attempt
 * created. `-x` is never used, so files matched by `.gitignore` are neither
 * staged, committed, nor removed.
 *
 * Residual limits: git does not track empty directories (rollback leaves none of
 * them behind either), and a write to a path already matched by `.gitignore` is
 * not reverted by `clean -fd`, because git has no baseline bytes for it.
 */
import { type OkfGitPort } from "./contracts.js";
/** Journal filename inside the resolved git directory. */
export declare const OKF_INGESTION_JOURNAL_FILE = "okf-ingestion-journal";
/** Subject of the initial commit `initialise` creates for a non-empty bundle. */
export declare const OKF_INITIAL_COMMIT_MESSAGE = "initial okf bundle";
/** Prefix of the snapshot commit that captures pre-existing working-tree changes. */
export declare const OKF_SNAPSHOT_COMMIT_PREFIX = "pre-ingest snapshot";
export interface OkfGitInspection {
    /** True only when `root` is the top level of its own git work tree. */
    readonly versioned: boolean;
    /** True when a `.git` exists in an ancestor of `root`. */
    readonly nested: boolean;
    /**
     * True only when `git status --porcelain` succeeds with empty output. A
     * folder outside a work tree therefore reports `false`.
     */
    readonly clean: boolean;
}
export interface OkfGitBeginOptions {
    readonly root: string;
    readonly label: string;
    readonly nowMs: number;
    readonly signal?: AbortSignal;
}
export interface OkfGitCommitResult {
    readonly commit: string;
}
export interface OkfGitSession {
    commit(): Promise<OkfGitCommitResult>;
    rollback(): Promise<void>;
}
export interface OkfGitJournalRecovery {
    readonly label: string;
}
export interface OkfGitTransaction {
    inspect(root: string, signal?: AbortSignal): Promise<OkfGitInspection>;
    initialise(root: string, signal?: AbortSignal): Promise<void>;
    begin(options: OkfGitBeginOptions): Promise<OkfGitSession>;
    recoverInterrupted(root: string, signal?: AbortSignal): Promise<OkfGitJournalRecovery | undefined>;
}
export declare function createOkfGitTransaction(port: OkfGitPort): OkfGitTransaction;
