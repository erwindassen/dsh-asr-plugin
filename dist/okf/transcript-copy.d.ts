import type { OkfFile, OkfMeetingView } from "./contracts.js";
/** Flatten to one line and escape every Markdown-significant character. */
export declare function escapeMarkdownInline(text: string): string;
/**
 * One committed transcript version as a stable Markdown page.
 *
 * The page is a pure function of the meeting snapshot: no clock, no locale, no
 * random id, so re-ingesting the same version rewrites identical bytes.
 */
export declare function renderTranscriptCopy(input: {
    readonly meeting: OkfMeetingView;
}): OkfFile;
