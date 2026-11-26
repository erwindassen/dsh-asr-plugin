import { mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { OkfError, } from "./contracts.js";
import { parseFrontmatter } from "./frontmatter-read.js";
import { buildOkfMeetingView } from "./meeting-view.js";
import { renderRollups } from "./rollups.js";
import { readOkfPages } from "./rollup-read.js";
import { renderTranscriptCopy } from "./transcript-copy.js";
import { meetingRelativePath, transcriptCopyRelativePath } from "./paths.js";
import { scanBundleLinks } from "./link-scan.js";
/** Stored names as a label-to-name map; a missing store means no attribution. */
function attribution(deps, meetingId) {
    // A stale panel row (a meeting deleted by a Sync, say) must not turn into an
    // opaque failure before the attempt log exists: the transcript lookup that
    // follows is the one that reports "no transcript" in the user's language.
    let stored = [];
    try {
        stored = deps.speakerNames?.list(meetingId) ?? [];
    }
    catch {
        stored = [];
    }
    const names = {};
    for (const entry of stored)
        names[entry.label] = entry.name;
    return names;
}
const MAX_BUNDLE_DEPTH = 8;
function requireConfiguredDirectory(settings) {
    const directory = settings.directory.trim();
    if (directory === "") {
        throw new OkfError("OKF_NOT_CONFIGURED", "Choose an Open knowledge base folder in settings first");
    }
    return directory;
}
/** Writes bundle-relative content through a sibling temp file and a rename. */
async function writeBundleFile(root, file) {
    const target = join(root, ...file.relativePath.split("/"));
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.okf-tmp`;
    try {
        await writeFile(temporary, file.content, { mode: 0o600 });
        await rename(temporary, target);
    }
    catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}
async function readBundlePages(root) {
    const pages = [];
    const walk = async (directory, depth) => {
        if (depth > MAX_BUNDLE_DEPTH)
            return;
        const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            const absolute = join(directory, entry.name);
            if (entry.isDirectory()) {
                await walk(absolute, depth + 1);
            }
            else if (entry.isFile() && entry.name.endsWith(".md")) {
                pages.push({
                    relativePath: relative(root, absolute).split(sep).join("/"),
                    content: await readFile(absolute, "utf8"),
                });
            }
        }
    };
    await walk(root, 0);
    return pages;
}
function meetingPageFromPage(page) {
    const { fields } = parseFrontmatter(page.content);
    const meetingId = fields["meeting"] ?? fields["id"];
    if (typeof meetingId !== "string" || meetingId.trim() === "")
        return null;
    const startedMs = Date.parse(typeof fields["started"] === "string" ? fields["started"] : "");
    const status = fields["status"];
    return {
        meetingId,
        title: typeof fields["title"] === "string" ? fields["title"] : meetingId,
        status: status === "draft" || status === "deprecated" ? status : "stable",
        startedAtMs: Number.isNaN(startedMs) ? 0 : startedMs,
    };
}
function bundleRows(pages, actions, deadlines) {
    return pages
        .filter((page) => page.relativePath.startsWith("meetings/") && page.relativePath !== "meetings/index.md")
        .flatMap((page) => {
        const meeting = meetingPageFromPage(page);
        if (meeting === null)
            return [];
        const actionCount = actions.filter((item) => item.sources.some((source) => source.meetingId === meeting.meetingId)).length;
        const deadlineCount = deadlines.filter((deadline) => deadline.meetingId === meeting.meetingId).length;
        return [{
                ...meeting,
                relativePath: page.relativePath,
                actionCount,
                deadlineCount,
            }];
    })
        .sort((left, right) => right.startedAtMs - left.startedAtMs);
}
/**
 * Text worth persisting for a failed attempt. Our own failures already read
 * well; a raw filesystem or runtime error is the interesting case, so its name,
 * errno code and message survive instead of a generic "Ingestion failed".
 * The bundle root is folded to `<bundle>` so no absolute path is stored.
 */
function failureDetail(error, root) {
    const raw = error instanceof OkfError
        ? error.message
        : error instanceof Error
            ? (() => {
                const code = error.code;
                const prefix = typeof code === "string" && code !== "" ? `${error.name} ${code}` : error.name;
                return `${prefix}: ${error.message}`;
            })()
            : "Ingestion failed";
    const folded = root === undefined || root === "" ? raw : raw.split(root).join("<bundle>");
    return folded.length > 400 ? `${folded.slice(0, 397)}...` : folded;
}
/** Stable code for a rejection, so a client can match it without parsing text. */
function failureCode(error, aborted) {
    if (error instanceof OkfError)
        return error.code;
    return aborted ? "CANCELLED_BY_USER" : "OKF_GIT_FAILED";
}
export function createOkfIngestionService(deps) {
    const now = deps.nowMs ?? (() => Date.now());
    const running = new Set();
    const shutdownController = new AbortController();
    function track(task) {
        running.add(task);
        void task.finally(() => running.delete(task)).catch(() => undefined);
        return task;
    }
    function combined(request) {
        return request.signal === undefined
            ? shutdownController.signal
            : AbortSignal.any([request.signal, shutdownController.signal]);
    }
    async function ingestOnce(request) {
        if (shutdownController.signal.aborted) {
            return {
                kind: "disabled",
                meetingId: request.meetingId,
                jobId: null,
                message: "OKF ingestion is shutting down",
            };
        }
        const settings = deps.settings();
        const directory = requireConfiguredDirectory(settings);
        const view = buildOkfMeetingView(deps.repository, request.meetingId, attribution(deps, request.meetingId));
        const root = await realpath(directory);
        return deps.lock.runExclusive(root, async () => {
            const signal = combined(request);
            const previous = deps.attempts.findAttempt(view.meetingId, view.transcriptVersion, root);
            if (previous?.state === "succeeded" && request.skipIfSucceeded === true) {
                return {
                    kind: "ingested",
                    meetingId: view.meetingId,
                    jobId: null,
                    message: `Already ingested ${view.meetingId}@v${view.transcriptVersion}`,
                };
            }
            const startedAtMs = now();
            let session;
            let attemptOpen = false;
            let committed = false;
            try {
                // The attempt is recorded before any git work, so a failure while
                // preparing the folder still explains itself in the panel and the log
                // instead of leaving the user with a generic message and no record.
                deps.attempts.beginAttempt({
                    meetingId: view.meetingId,
                    transcriptVersion: view.transcriptVersion,
                    directory: root,
                    startedAtMs,
                });
                attemptOpen = true;
                const inspection = await deps.git.inspect(root, signal);
                if (!inspection.versioned) {
                    // The folder the user picked in settings is the bundle by definition,
                    // so the first ingestion makes it a repository instead of refusing to
                    // run. `initialise` is idempotent and leaves an empty tree uncommitted.
                    await deps.git.initialise(root, signal);
                }
                const interrupted = await deps.git.recoverInterrupted(root, signal);
                if (interrupted !== undefined) {
                    deps.logger?.(`recovered interrupted OKF ingestion ${interrupted.label}`);
                }
                session = await deps.git.begin({
                    root,
                    label: `ingest ${view.meetingId}@v${view.transcriptVersion}`,
                    nowMs: startedAtMs,
                    signal,
                });
                const copy = renderTranscriptCopy({ meeting: view });
                const existingCopy = await readFile(join(root, ...copy.relativePath.split("/")), "utf8").catch(() => null);
                if (existingCopy !== copy.content)
                    await writeBundleFile(root, copy);
                const outcome = await deps.agent.ingest({
                    directory: root,
                    meeting: view,
                    transcriptCopyPath: transcriptCopyRelativePath(view.meetingId),
                    signal,
                });
                if (outcome.kind === "failed") {
                    throw new OkfError("OKF_AGENT_FAILED", outcome.message ?? "The summarising agent failed");
                }
                const agentPages = await readBundlePages(root);
                const meetingPage = meetingRelativePath(view);
                if (!agentPages.some((page) => page.relativePath === meetingPage)) {
                    // A silent "success" without the meeting page would commit rollups that
                    // do not mention this meeting, so it counts as an agent failure.
                    throw new OkfError("OKF_AGENT_FAILED", "The summarising agent did not write this meeting's page");
                }
                const items = readOkfPages(agentPages);
                const rows = bundleRows(agentPages, items.actions, items.deadlines);
                const rollups = renderRollups({
                    generatedAtMs: now(),
                    meetings: rows,
                    actions: items.actions,
                    deadlines: items.deadlines,
                });
                for (const rollup of rollups)
                    await writeBundleFile(root, rollup);
                const allPages = [...agentPages.filter((page) => !rollups.some((rollup) => rollup.relativePath === page.relativePath)), ...rollups];
                const escaping = scanBundleLinks({
                    files: allPages,
                    existingPaths: allPages.map((page) => page.relativePath),
                }).filter((violation) => violation.reason === "outside-bundle");
                if (escaping.length > 0) {
                    // Only a link that leaves the bundle is fatal: a missing target is how
                    // the generated rollups reference a page the agent chose to name.
                    throw new OkfError("OKF_LINK_OUTSIDE_BUNDLE", `${escaping.length} link(s) leave the Open knowledge base`);
                }
                const result = await session.commit();
                committed = true;
                try {
                    deps.attempts.finishAttempt({
                        meetingId: view.meetingId,
                        transcriptVersion: view.transcriptVersion,
                        directory: root,
                        state: "succeeded",
                        finishedAtMs: now(),
                    });
                    attemptOpen = false;
                }
                catch (error) {
                    // The bundle is committed; a bookkeeping failure must not report a
                    // failed ingestion nor touch the worktree.
                    deps.logger?.(`OKF ingestion bookkeeping failed: ${error instanceof Error ? error.name : "unknown"}`);
                    attemptOpen = false;
                }
                const short = result.commit === "" ? "a new commit" : result.commit.slice(0, 12);
                return {
                    kind: outcome.kind,
                    meetingId: view.meetingId,
                    jobId: null,
                    message: `Ingested ${view.meetingId}@v${view.transcriptVersion} as ${short}`,
                };
            }
            catch (error) {
                if (session !== undefined && !committed) {
                    const failure = await session.rollback().then(() => undefined, (rollbackError) => rollbackError);
                    if (failure !== undefined) {
                        // The journal stays behind, so startup recovery still has a target.
                        deps.logger?.("OKF ingestion rollback failed; the journal was kept for recovery");
                    }
                }
                const code = error instanceof OkfError
                    ? error.code
                    : signal.aborted
                        ? "CANCELLED_BY_USER"
                        : "OKF_GIT_FAILED";
                if (attemptOpen) {
                    try {
                        deps.attempts.finishAttempt({
                            meetingId: view.meetingId,
                            transcriptVersion: view.transcriptVersion,
                            directory: root,
                            state: "failed",
                            finishedAtMs: now(),
                            errorCode: code,
                            errorMessage: failureDetail(error).slice(0, 200),
                        });
                    }
                    catch (bookkeepingError) {
                        deps.logger?.(`OKF ingestion bookkeeping failed: ${bookkeepingError instanceof Error ? bookkeepingError.name : "unknown"}`);
                    }
                }
                if (error instanceof OkfError)
                    throw error;
                if (signal.aborted) {
                    throw new OkfError("CANCELLED_BY_USER", "Ingestion was cancelled", { cause: error });
                }
                throw new OkfError("OKF_GIT_FAILED", "Ingestion failed and was rolled back", { cause: error });
            }
        });
    }
    return {
        start(request) {
            const settings = deps.settings();
            if (settings.directory.trim() === "") {
                return {
                    kind: "disabled",
                    meetingId: request.meetingId,
                    jobId: null,
                    message: "Choose an Open knowledge base folder in settings first",
                };
            }
            if (shutdownController.signal.aborted) {
                return {
                    kind: "disabled",
                    meetingId: request.meetingId,
                    jobId: null,
                    message: "OKF ingestion is shutting down",
                };
            }
            let resolveDone = () => undefined;
            const done = new Promise((resolveHeld) => { resolveDone = resolveHeld; });
            const controller = new AbortController();
            const id = deps.jobs.start({
                kind: "asr-okf-ingest",
                label: "Summarise meeting into Open knowledge base",
                run: (job) => {
                    job.updateProgress("summarising");
                    track(ingestOnce({ ...request, signal: controller.signal }).then(resolveDone, (error) => resolveDone({
                        kind: "failed",
                        meetingId: request.meetingId,
                        jobId: String(job.id),
                        // Keep the real cause: the panel shows this text, and a generic
                        // "failed and was rolled back" tells nobody what to fix.
                        message: `${failureCode(error, controller.signal.aborted)}: ${failureDetail(error, settings.directory)}`,
                    })));
                    return {
                        cancel: () => controller.abort(),
                        done: done.then((outcome) => ({
                            status: outcome.kind === "failed" ? "failed" : "completed",
                            ...(outcome.kind === "failed" ? { detail: outcome.message } : {}),
                        })),
                    };
                },
            });
            return {
                kind: "started",
                meetingId: request.meetingId,
                jobId: String(id),
                message: "Ingestion started",
            };
        },
        async run(request) {
            return track(ingestOnce(request));
        },
        async recoverStartup() {
            const settings = deps.settings();
            if (settings.directory.trim() === "")
                return;
            const root = await realpath(settings.directory).catch(() => null);
            if (root === null)
                return;
            const interrupted = await deps.git.recoverInterrupted(root).catch(() => undefined);
            if (interrupted !== undefined) {
                deps.logger?.(`recovered interrupted OKF ingestion ${interrupted.label}`);
            }
            // A row still marked running means the process that wrote it is gone: this
            // host holds the bundle lock and just rolled its worktree back.
            for (const record of deps.attempts.listRunning(50)) {
                try {
                    deps.attempts.finishAttempt({
                        meetingId: record.meetingId,
                        transcriptVersion: record.transcriptVersion,
                        directory: record.directory,
                        state: "failed",
                        finishedAtMs: now(),
                        errorCode: "OKF_JOURNAL_UNCLOSED",
                        errorMessage: "Ingestion was interrupted by a previous shutdown",
                    });
                }
                catch {
                    continue;
                }
            }
        },
        state(meetingId) {
            return deps.attempts.findLatestForMeeting(meetingId);
        },
        async whenIdle() {
            while (running.size > 0) {
                await Promise.allSettled([...running]);
            }
        },
        async shutdown() {
            shutdownController.abort();
            await this.whenIdle();
        },
    };
}
//# sourceMappingURL=ingestion-service.js.map