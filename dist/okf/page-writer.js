import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { OkfError } from "./contracts.js";
import { resolveBundlePath } from "./paths.js";
/**
 * Folders a summarising agent may write into.
 *
 * `references/` is deliberately absent: the transcript copy must stay a
 * byte-for-byte mirror of the committed text, so the plugin owns it. Every
 * `index.md` and the deadline rollup are regenerated from the database after the
 * agent finishes, so those are plugin-owned too.
 */
export const OKF_PAGE_ROOTS = [
    "meetings",
    "actions",
    "deadlines",
    "entities",
    "concepts",
    "sources",
];
/** One page is a summary, not a data dump; the cap keeps a runaway loop bounded. */
export const OKF_PAGE_MAX_BYTES = 262_144;
function invalidPage(relativePath, reason) {
    return new OkfError("OKF_PAGE_INVALID", `The page ${JSON.stringify(relativePath)} ${reason}`);
}
/**
 * Prove a path is one the agent is allowed to write before touching the disk.
 *
 * `resolveBundlePath` already refuses escapes and unsupported characters; this
 * adds the bundle's own layout rules so a page can never land in a folder the
 * ingestion treats as its own.
 */
export function assertWritablePage(relativePath) {
    if (!relativePath.endsWith(".md"))
        throw invalidPage(relativePath, "must end with .md");
    const segments = relativePath.split("/");
    if (segments.length < 2)
        throw invalidPage(relativePath, "must live inside a page folder");
    if (segments[segments.length - 1] === "index.md") {
        throw invalidPage(relativePath, "is a rollup the plugin regenerates");
    }
    const root = segments[0] ?? "";
    if (!OKF_PAGE_ROOTS.includes(root)) {
        throw invalidPage(relativePath, "is outside the page folders");
    }
}
/**
 * Write one page inside the bundle.
 *
 * The write is atomic: the content lands in a temporary sibling and is renamed
 * over the target, so a crash mid-write cannot leave half a page behind the git
 * transaction that is about to commit it.
 */
export async function writeOkfPage(root, relativePath, content, options = {}) {
    assertWritablePage(relativePath);
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > OKF_PAGE_MAX_BYTES) {
        throw new OkfError("OKF_PAGE_TOO_LARGE", `A page may not exceed ${String(OKF_PAGE_MAX_BYTES)} bytes; split it into smaller pages`);
    }
    const target = await resolveBundlePath(root, relativePath, options.realRoot);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${String(process.pid)}.okf-tmp`;
    try {
        await writeFile(temporary, content, "utf8");
        await rename(temporary, target);
    }
    catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
    return { relativePath, bytes };
}
//# sourceMappingURL=page-writer.js.map