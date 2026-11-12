import type { DraftTranscriptSegment, DraftTranscriptSnapshot } from "./worker-types.js";
export type DraftTranscriptPageErrorCode = "INVALID_INPUT" | "DRAFT_REVISION_CONFLICT";
export declare class DraftTranscriptPageError extends Error {
    readonly code: DraftTranscriptPageErrorCode;
    constructor(code: DraftTranscriptPageErrorCode, message: string);
}
export interface GetDraftTranscriptPageInput {
    readonly meetingId: string;
    readonly snapshot: DraftTranscriptSnapshot;
    readonly cursor?: string;
    readonly limit?: number;
}
export interface DraftTranscriptPage {
    readonly revision: number;
    readonly audioThroughMs: number;
    readonly generatedAtMs: number;
    readonly segments: readonly DraftTranscriptSegment[];
    readonly nextCursor: string | null;
}
export declare function isDraftTranscriptCursor(value: string): boolean;
export declare function getDraftTranscriptPage(input: GetDraftTranscriptPageInput): DraftTranscriptPage;
export declare class DraftTranscriptPager {
    private readonly now;
    private readonly retained;
    constructor(now?: () => number);
    page(input: GetDraftTranscriptPageInput): DraftTranscriptPage;
    private expire;
    private retain;
    private snapshot;
}
