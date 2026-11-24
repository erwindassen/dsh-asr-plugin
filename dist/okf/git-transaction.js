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
import { open, readFile, realpath, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { OkfError } from "./contracts.js";
/** Journal filename inside the resolved git directory. */
export const OKF_INGESTION_JOURNAL_FILE = "okf-ingestion-journal";
/** Subject of the initial commit `initialise` creates for a non-empty bundle. */
export const OKF_INITIAL_COMMIT_MESSAGE = "initial okf bundle";
/** Prefix of the snapshot commit that captures pre-existing working-tree changes. */
export const OKF_SNAPSHOT_COMMIT_PREFIX = "pre-ingest snapshot";
/**
 * Every invocation shares this prefix: no pager, a fixed synthetic identity, no
 * signing, and no repository hooks, so ingestion never depends on user config.
 */
const GIT_PREFIX = [
    "--no-pager",
    "-c", "user.name=dsh-asr",
    "-c", "user.email=dsh-asr@localhost",
    "-c", "commit.gpgsign=false",
    "-c", "core.hooksPath=",
];
const LABEL_PATTERN = /^[a-z0-9@._ -]+$/u;
const MAX_LABEL_LENGTH = 256;
const COMMIT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const FOREIGN_LOCK_PATTERN = /index\.lock/u;
const LOCK_RETRY_ATTEMPTS = 8;
const LOCK_RETRY_BASE_MS = 100;
const MAX_ERROR_DETAIL_LENGTH = 512;
function abortReason(signal) {
    const reason = signal.reason;
    if (reason instanceof Error)
        return reason;
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    return error;
}
function throwIfAborted(signal) {
    if (signal !== undefined && signal.aborted)
        throw abortReason(signal);
}
function firstLine(text) {
    const trimmed = text.trim();
    if (trimmed === "")
        return "";
    const line = trimmed.split(/\r?\n/u)[0] ?? "";
    return line.length > MAX_ERROR_DETAIL_LENGTH
        ? line.slice(0, MAX_ERROR_DETAIL_LENGTH)
        : line;
}
/** Carries the git exit code and only the first stderr line: never file bytes. */
function gitFailure(action, result) {
    const code = result.code === null ? "unknown" : String(result.code);
    const detail = firstLine(result.stderr);
    const message = detail === ""
        ? `git ${action} exited with code ${code}`
        : `git ${action} exited with code ${code}: ${detail}`;
    return new OkfError("OKF_GIT_FAILED", message);
}
function isErrnoCode(error, code) {
    return error instanceof Error && error.code === code;
}
function isCommitId(value) {
    return COMMIT_ID_PATTERN.test(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sleep(ms, signal) {
    return new Promise((resolveSleep) => {
        const onAbort = () => {
            clearTimeout(timer);
            resolveSleep();
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolveSleep();
        }, ms);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
async function pathExists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}
async function realpathOrUndefined(path) {
    if (path === "")
        return undefined;
    try {
        return await realpath(path);
    }
    catch {
        return undefined;
    }
}
async function syncDirectory(path) {
    let handle;
    try {
        handle = await open(path, "r");
        await handle.sync();
    }
    catch {
        // Directory fsync is unavailable on some filesystems; the file fsync above
        // still orders the journal content before any worktree write.
    }
    finally {
        await handle?.close().catch(() => undefined);
    }
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return isErrnoCode(error, "EPERM");
    }
}
function assertLabel(label) {
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH || !LABEL_PATTERN.test(label)) {
        // The raw label may be derived from the transcript, so it is never echoed.
        throw new OkfError("OKF_GIT_FAILED", "ingestion label must match [a-z0-9@._ -]+");
    }
}
function parseJournal(value) {
    if (!isRecord(value))
        return undefined;
    const label = value["label"];
    const kind = value["baselineKind"];
    const sha = value["baselineSha"];
    const pid = value["pid"];
    if (typeof label !== "string" || label === "")
        return undefined;
    const owner = typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0 ? pid : 0;
    if (kind === "commit") {
        if (typeof sha !== "string" || !isCommitId(sha))
            return undefined;
        return { label, baseline: { kind: "commit", sha }, pid: owner };
    }
    if (kind === "empty-tree") {
        if (sha !== null)
            return undefined;
        return { label, baseline: { kind: "empty-tree", sha: null }, pid: owner };
    }
    return undefined;
}
export function createOkfGitTransaction(port) {
    async function resolveRoot(root) {
        const absolute = resolve(root);
        try {
            return await realpath(absolute);
        }
        catch (error) {
            throw new OkfError("OKF_GIT_FAILED", "OKF bundle directory is not accessible", {
                cause: error,
            });
        }
    }
    /**
     * Runs one git invocation. Foreign `index.lock` failures are retried with
     * bounded exponential backoff; the lock file is never touched. A non-zero
     * result is returned to the caller, which decides whether it is fatal.
     */
    async function git(argv, cwd, signal, action) {
        for (let attempt = 1;; attempt += 1) {
            throwIfAborted(signal);
            let result;
            try {
                const options = signal === undefined ? { cwd } : { cwd, signal };
                result = await port.run(["git", ...GIT_PREFIX, ...argv], options);
            }
            catch (error) {
                if (signal !== undefined && signal.aborted)
                    throw abortReason(signal);
                throw new OkfError("OKF_GIT_FAILED", `git ${action} could not run`, { cause: error });
            }
            if (result.code === 0)
                return result;
            throwIfAborted(signal);
            if (FOREIGN_LOCK_PATTERN.test(result.stderr)) {
                if (attempt >= LOCK_RETRY_ATTEMPTS) {
                    throw new OkfError("OKF_BUSY", `git ${action} could not acquire the git index after ${attempt} attempts`);
                }
                await sleep(LOCK_RETRY_BASE_MS * 2 ** (attempt - 1), signal);
                continue;
            }
            return result;
        }
    }
    async function gitOk(argv, cwd, signal, action) {
        const result = await git(argv, cwd, signal, action);
        if (result.code !== 0)
            throw gitFailure(action, result);
        return result;
    }
    async function repositoryContext(realRoot, signal) {
        const top = await git(["rev-parse", "--show-toplevel"], realRoot, signal, "rev-parse --show-toplevel");
        if (top.code !== 0) {
            throw new OkfError("OKF_NOT_VERSIONED", "OKF bundle directory is not a git repository");
        }
        if (await realpathOrUndefined(top.stdout.trim()) !== realRoot) {
            throw new OkfError("OKF_NOT_VERSIONED", "OKF bundle directory is not the top level of its git repository");
        }
        const dir = await gitOk(["rev-parse", "--absolute-git-dir"], realRoot, signal, "rev-parse --absolute-git-dir");
        const gitDir = dir.stdout.trim();
        if (gitDir === "" || !isAbsolute(gitDir)) {
            throw new OkfError("OKF_GIT_FAILED", "git rev-parse --absolute-git-dir returned an unexpected path");
        }
        return { gitDir };
    }
    async function hasAncestorRepository(realRoot) {
        let current = dirname(realRoot);
        for (;;) {
            if (await pathExists(join(current, ".git")))
                return true;
            const parent = dirname(current);
            if (parent === current)
                return false;
            current = parent;
        }
    }
    async function headOrUndefined(realRoot, signal) {
        const head = await git(["rev-parse", "--verify", "--quiet", "HEAD"], realRoot, signal, "rev-parse --verify HEAD");
        if (head.code !== 0)
            return undefined;
        const sha = head.stdout.trim();
        if (!isCommitId(sha)) {
            throw new OkfError("OKF_GIT_FAILED", "git rev-parse HEAD returned an unexpected value");
        }
        return sha;
    }
    async function createSnapshotCommit(realRoot, nowMs, signal) {
        if (!Number.isFinite(nowMs)) {
            throw new OkfError("OKF_GIT_FAILED", "ingestion timestamp is not a finite number");
        }
        const message = `${OKF_SNAPSHOT_COMMIT_PREFIX} ${new Date(nowMs).toISOString()}`;
        await gitOk(["add", "-A"], realRoot, signal, "add");
        await gitOk(["commit", "--no-verify", "-m", message], realRoot, signal, "commit");
        const head = await gitOk(["rev-parse", "HEAD"], realRoot, signal, "rev-parse HEAD");
        const sha = head.stdout.trim();
        if (!isCommitId(sha)) {
            throw new OkfError("OKF_GIT_FAILED", "git rev-parse HEAD returned an unexpected value");
        }
        return sha;
    }
    /**
     * Picks the rollback target. Human edits present before the attempt are first
     * folded into one snapshot commit, so they are inside the target too. A
     * repository without commits records the empty-tree case explicitly.
     */
    async function prepareBaseline(realRoot, nowMs, signal) {
        const status = await gitOk(["status", "--porcelain"], realRoot, signal, "status --porcelain");
        const dirty = status.stdout.trim() !== "";
        const head = await headOrUndefined(realRoot, signal);
        if (head !== undefined && !dirty)
            return { kind: "commit", sha: head };
        if (head !== undefined || dirty) {
            return { kind: "commit", sha: await createSnapshotCommit(realRoot, nowMs, signal) };
        }
        return { kind: "empty-tree", sha: null };
    }
    async function writeJournal(gitDir, record) {
        const path = join(gitDir, OKF_INGESTION_JOURNAL_FILE);
        const handle = await open(path, "w", 0o600);
        try {
            await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await syncDirectory(gitDir);
    }
    async function removeJournal(gitDir) {
        await rm(join(gitDir, OKF_INGESTION_JOURNAL_FILE), { force: true });
        await syncDirectory(gitDir);
    }
    async function readJournal(gitDir) {
        const path = join(gitDir, OKF_INGESTION_JOURNAL_FILE);
        let text;
        try {
            text = await readFile(path, "utf8");
        }
        catch (error) {
            if (isErrnoCode(error, "ENOENT"))
                return undefined;
            throw new OkfError("OKF_JOURNAL_UNCLOSED", "ingestion journal could not be read", {
                cause: error,
            });
        }
        let value;
        try {
            value = JSON.parse(text);
        }
        catch (error) {
            throw new OkfError("OKF_JOURNAL_UNCLOSED", "ingestion journal is not valid JSON", {
                cause: error,
            });
        }
        const journal = parseJournal(value);
        if (journal === undefined) {
            throw new OkfError("OKF_JOURNAL_UNCLOSED", "ingestion journal has an unsupported shape");
        }
        return journal;
    }
    /**
     * Restores the worktree, then removes the journal, then verifies cleanliness.
     * The empty-tree baseline means the repository never had a commit, so HEAD is
     * returned to the unborn state and the index is emptied with `read-tree`:
     * `rm -r --cached` would leave the index entries behind.
     */
    async function restoreBaseline(realRoot, baseline, gitDir, signal, keepJournalOnFailure) {
        try {
            if (baseline.kind === "empty-tree") {
                const head = await headOrUndefined(realRoot, signal);
                if (head !== undefined) {
                    await gitOk(["update-ref", "-d", "HEAD"], realRoot, signal, "update-ref -d HEAD");
                }
                await gitOk(["read-tree", "--empty"], realRoot, signal, "read-tree --empty");
            }
            else {
                await gitOk(["reset", "--hard", baseline.sha], realRoot, signal, "reset --hard");
            }
            await gitOk(["clean", "-fd"], realRoot, signal, "clean -fd");
        }
        catch (error) {
            if (!keepJournalOnFailure) {
                await removeJournal(gitDir).catch(() => undefined);
            }
            throw error;
        }
        await removeJournal(gitDir);
        const status = await gitOk(["status", "--porcelain"], realRoot, signal, "status --porcelain");
        if (status.stdout.trim() !== "") {
            throw new OkfError("OKF_GIT_FAILED", "worktree is not clean after rollback");
        }
    }
    async function recoverJournal(realRoot, gitDir, signal) {
        const journal = await readJournal(gitDir);
        if (journal === undefined)
            return undefined;
        if (journal.pid !== 0 && journal.pid !== process.pid && isProcessAlive(journal.pid)) {
            // Another host is mid-ingestion in this bundle. Rolling its worktree back
            // would destroy work this process cannot see, so wait for it instead.
            throw new OkfError("OKF_BUSY", "another process is ingesting into this Open knowledge base");
        }
        try {
            await restoreBaseline(realRoot, journal.baseline, gitDir, signal, true);
        }
        catch (error) {
            if (signal !== undefined && signal.aborted)
                throw abortReason(signal);
            if (error instanceof OkfError && (error.code === "OKF_BUSY" || error.code === "OKF_NOT_VERSIONED")) {
                throw error;
            }
            throw new OkfError("OKF_JOURNAL_UNCLOSED", "an interrupted ingestion could not be rolled back", { cause: error });
        }
        return { label: journal.label };
    }
    /**
     * Reads the new HEAD and clears the journal. Both are bookkeeping: the commit
     * already landed, so a failure here is reported as an unknown id, never as a
     * failed ingestion.
     */
    async function committedSha(realRoot, gitDir, signal) {
        let sha = "";
        try {
            const head = await gitOk(["rev-parse", "HEAD"], realRoot, signal, "rev-parse HEAD");
            const value = head.stdout.trim();
            if (isCommitId(value))
                sha = value;
        }
        catch {
            sha = "";
        }
        await removeJournal(gitDir).catch(() => undefined);
        return sha;
    }
    function createSession(realRoot, gitDir, label, baseline, signal) {
        let state = "open";
        let committed;
        return {
            async commit() {
                if (state === "committed" && committed !== undefined)
                    return committed;
                if (state === "rolled-back") {
                    throw new OkfError("OKF_GIT_FAILED", "ingestion transaction was already rolled back");
                }
                try {
                    await gitOk(["add", "-A"], realRoot, signal, "add");
                    await gitOk(["commit", "--no-verify", "-m", label], realRoot, signal, "commit");
                    // The commit object exists from here on, so the transaction is
                    // irreversible: a later failure must not roll the worktree back.
                    state = "committed";
                }
                catch (error) {
                    if (signal !== undefined && signal.aborted) {
                        // An aborted attempt must not leave its partial worktree behind.
                        try {
                            await restoreBaseline(realRoot, baseline, gitDir, undefined, true);
                        }
                        catch (rollbackError) {
                            throw new OkfError("OKF_GIT_FAILED", "aborted ingestion could not be rolled back", { cause: rollbackError });
                        }
                        state = "rolled-back";
                        throw abortReason(signal);
                    }
                    throw error;
                }
                committed = { commit: await committedSha(realRoot, gitDir, signal) };
                return committed;
            },
            async rollback() {
                if (state === "rolled-back")
                    return;
                if (state === "committed") {
                    throw new OkfError("OKF_GIT_FAILED", "ingestion transaction is already committed");
                }
                // Cleanup must still run when the caller aborted: the abort signal only
                // orders the attempt's own git calls.
                const cleanupSignal = signal !== undefined && signal.aborted ? undefined : signal;
                // A failed restore keeps the journal: without it the dirty worktree has
                // no rollback target left and the next ingestion would commit the debris.
                await restoreBaseline(realRoot, baseline, gitDir, cleanupSignal, true);
                state = "rolled-back";
            },
        };
    }
    async function inspect(root, signal) {
        throwIfAborted(signal);
        const realRoot = await resolveRoot(root);
        const top = await git(["rev-parse", "--show-toplevel"], realRoot, signal, "rev-parse --show-toplevel");
        let versioned = false;
        if (top.code === 0) {
            versioned = await realpathOrUndefined(top.stdout.trim()) === realRoot;
        }
        const nested = await hasAncestorRepository(realRoot);
        const status = await git(["status", "--porcelain"], realRoot, signal, "status --porcelain");
        const clean = status.code === 0 && status.stdout.trim() === "";
        return { versioned, nested, clean };
    }
    async function initialise(root, signal) {
        throwIfAborted(signal);
        const realRoot = await resolveRoot(root);
        const top = await git(["rev-parse", "--show-toplevel"], realRoot, signal, "rev-parse --show-toplevel");
        if (top.code === 0 && await realpathOrUndefined(top.stdout.trim()) === realRoot) {
            return;
        }
        await gitOk(["init"], realRoot, signal, "init");
        await gitOk(["add", "-A"], realRoot, signal, "add");
        const status = await gitOk(["status", "--porcelain"], realRoot, signal, "status --porcelain");
        // An empty (or entirely ignored) tree stays uncommitted: it is a legal
        // repository state and the empty-tree baseline handles it.
        if (status.stdout.trim() === "")
            return;
        await gitOk(["commit", "--no-verify", "-m", OKF_INITIAL_COMMIT_MESSAGE], realRoot, signal, "commit");
    }
    async function begin(options) {
        const { root, label, nowMs, signal } = options;
        throwIfAborted(signal);
        assertLabel(label);
        const realRoot = await resolveRoot(root);
        const context = await repositoryContext(realRoot, signal);
        // A journal from a previous process is rolled back before this attempt
        // chooses its own baseline.
        await recoverJournal(realRoot, context.gitDir, signal);
        const baseline = await prepareBaseline(realRoot, nowMs, signal);
        const record = {
            version: 1,
            label,
            baselineKind: baseline.kind,
            baselineSha: baseline.sha,
            startedAtMs: nowMs,
            pid: process.pid,
        };
        await writeJournal(context.gitDir, record);
        return createSession(realRoot, context.gitDir, label, baseline, signal);
    }
    async function recoverInterrupted(root, signal) {
        throwIfAborted(signal);
        const realRoot = await resolveRoot(root);
        const top = await git(["rev-parse", "--show-toplevel"], realRoot, signal, "rev-parse --show-toplevel");
        if (top.code !== 0)
            return undefined;
        if (await realpathOrUndefined(top.stdout.trim()) !== realRoot)
            return undefined;
        const context = await repositoryContext(realRoot, signal);
        return await recoverJournal(realRoot, context.gitDir, signal);
    }
    return { inspect, initialise, begin, recoverInterrupted };
}
//# sourceMappingURL=git-transaction.js.map