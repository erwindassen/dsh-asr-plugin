import type { OkfFile, OkfLinkViolation } from "./contracts.js";
/**
 * Check every inline link in the given pages.
 *
 * Frontmatter and fenced code blocks are not Markdown bodies, so they are
 * skipped while line numbering stays relative to the whole file. Relative
 * targets resolve from the containing page's directory; `#fragment` and
 * `?query` are ignored for resolution but kept in the reported target.
 * Violations sort by page, then line, then target.
 */
export declare function scanBundleLinks(input: {
    readonly files: readonly OkfFile[];
    readonly existingPaths?: readonly string[];
}): readonly OkfLinkViolation[];
