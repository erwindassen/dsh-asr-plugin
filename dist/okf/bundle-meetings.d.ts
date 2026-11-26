/**
 * Lists the meetings a bundle actually holds.
 *
 * The plugin's own transcript copies are the only machine-authored pages in the
 * bundle, so they are the trustworthy answer to "which meetings live in this
 * folder". Pages under `meetings/` are written by a model and are deliberately
 * ignored here: a hand-edited or hallucinated page must never resurrect or drop
 * a stored meeting.
 */
/** Bundle roots whose copies could not be read simply hold no meetings. */
export declare function listBundleMeetingIds(root: string): Promise<readonly string[]>;
