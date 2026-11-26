/**
 * Folders a summarising agent may write into.
 *
 * `references/` is deliberately absent: the transcript copy must stay a
 * byte-for-byte mirror of the committed text, so the plugin owns it. Every
 * `index.md` and the deadline rollup are regenerated from the database after the
 * agent finishes, so those are plugin-owned too.
 */
export declare const OKF_PAGE_ROOTS: readonly ["meetings", "actions", "deadlines", "entities", "concepts", "sources"];
/** One page is a summary, not a data dump; the cap keeps a runaway loop bounded. */
export declare const OKF_PAGE_MAX_BYTES = 262144;
export interface OkfWrittenPage {
    readonly relativePath: string;
    readonly bytes: number;
}
/**
 * Prove a path is one the agent is allowed to write before touching the disk.
 *
 * `resolveBundlePath` already refuses escapes and unsupported characters; this
 * adds the bundle's own layout rules so a page can never land in a folder the
 * ingestion treats as its own.
 */
export declare function assertWritablePage(relativePath: string): void;
/**
 * Write one page inside the bundle.
 *
 * The write is atomic: the content lands in a temporary sibling and is renamed
 * over the target, so a crash mid-write cannot leave half a page behind the git
 * transaction that is about to commit it.
 */
export declare function writeOkfPage(root: string, relativePath: string, content: string, options?: {
    readonly realRoot?: string;
}): Promise<OkfWrittenPage>;
