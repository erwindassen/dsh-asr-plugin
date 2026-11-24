/**
 * In-process serialisation for one OKF bundle directory.
 *
 * Two ingestions of the same bundle must never interleave: the git transaction
 * records a baseline and a journal in the shared `.git` directory, so a second
 * begin would roll back the first attempt's worktree. The lock is keyed by the
 * real path of the bundle root (symlink aliases share one queue) and is a FIFO
 * chain of promises, so waiting tasks run in arrival order. Different bundles
 * keep separate chains and run concurrently.
 *
 * The lock lives in one process only; it is not an inter-process mutex. The git
 * journal plus the `index.lock` retry path cover concurrent host processes.
 */
export interface OkfBundleLock {
    runExclusive<T>(root: string, task: () => Promise<T>): Promise<T>;
}
export declare function createOkfBundleLock(): OkfBundleLock;
