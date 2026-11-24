import type { OkfActionItem, OkfMeetingView } from "./contracts.js";
/** Bundle-relative paths that every bundle carries. */
export declare const OKF_ROOT_INDEX = "index.md";
export declare const OKF_MEETINGS_INDEX = "meetings/index.md";
export declare const OKF_ACTIONS_INDEX = "actions/index.md";
export declare const OKF_DEADLINES_INDEX = "deadlines/index.md";
export declare const OKF_TRANSCRIPTS_DIRECTORY = "references/transcripts";
/**
 * Deterministic ASCII slug for a meeting title or action title.
 *
 * Diacritics fold to ASCII; everything else outside `[a-z0-9]` becomes a
 * separator. A title with no ASCII letters or digits (for example a
 * Chinese-only title) falls back to `m-<8 hex>` derived from the raw trimmed
 * text, because `sha256` is stable across runs, platforms and Node versions.
 */
export declare function normalizeOkfSlug(text: string): string;
/**
 * `startedAtMs` is read in UTC on purpose.
 *
 * The plugin and its CI must produce byte-identical pages on every machine, so
 * the calendar date never depends on the writer's local time zone. A meeting
 * recorded at 23:30 UTC belongs to that UTC date even when the user's clock has
 * already rolled over. Callers that need local grouping can filter before
 * calling this function; the bundle itself is time-zone free.
 */
export declare function meetingRelativePath(meeting: OkfMeetingView): string;
/** Transcript copies are keyed by meeting id so re-ingestion overwrites one page. */
export declare function transcriptCopyRelativePath(meetingId: string): string;
/**
 * `actions/<slug>.md` is shared with the page authoring slice: the same helper
 * keeps rollup links and authored pages in agreement. Titles that collapse to
 * the same slug address the same page, so callers deduplicate by title first.
 */
export declare function actionRelativePath(item: Pick<OkfActionItem, "title">): string;
/**
 * Reject a bundle-relative path that could leave the bundle or that the page
 * layout cannot address. Deliberately stricter than the OS: lowercase ASCII,
 * forward slashes and no empty, `.` or `..` segment.
 */
export declare function assertSafeRelativePath(relativePath: string): void;
/**
 * Join a validated relative path under `root` and prove the real parent still
 * lives inside the bundle. `realRoot` may be supplied by the caller when it has
 * already resolved the root; it is then used verbatim as the canonical root.
 * Reads only directory metadata, never page contents.
 */
export declare function resolveBundlePath(root: string, relativePath: string, realRoot?: string): Promise<string>;
