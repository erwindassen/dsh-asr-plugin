export interface TranscriptCursor {
    readonly kind: "transcript";
    readonly meetingId: string;
    readonly version: number;
    readonly lastSeq: number;
    readonly projection?: "page" | "agent";
    readonly nextSegmentDigest?: string;
}
export interface SearchCursor {
    readonly kind: "search";
    readonly queryHash: string;
    readonly createdAtMs: number;
    readonly meetingId: string;
}
export declare function encodeTranscriptCursor(payload: Omit<TranscriptCursor, "kind">): string;
export declare function decodeTranscriptCursor(cursor: string): TranscriptCursor;
export declare function encodeSearchCursor(payload: Omit<SearchCursor, "kind">): string;
export declare function decodeSearchCursor(cursor: string): SearchCursor;
