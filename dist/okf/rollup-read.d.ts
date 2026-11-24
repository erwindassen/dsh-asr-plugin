import type { OkfActionItem, OkfDeadline, OkfFile } from "./contracts.js";
/** Facts the rollups need, read back from authored pages instead of SQLite. */
export interface OkfRollupPages {
    readonly actions: readonly OkfActionItem[];
    readonly deadlines: readonly OkfDeadline[];
}
/**
 * Read bundle pages back into rollup facts.
 *
 * Only `actions/*.md` and `deadlines/*.md` pages carrying a `state` field are
 * understood; everything else, including pages an agent wrote in a shape this
 * reader does not know, is skipped rather than failing the whole ingestion.
 * Results sort by id so the caller sees a stable order regardless of input.
 */
export declare function readOkfPages(files: readonly OkfFile[]): OkfRollupPages;
