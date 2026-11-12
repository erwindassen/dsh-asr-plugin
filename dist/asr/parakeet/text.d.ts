/**
 * Punctuation table keyed like the FunASR `punc_list`: index 0 is the unknown
 * slot and index 1 is "no break", so the shared block builders normalize a
 * zero id to the same "no break" mark. Real marks therefore start at index 2.
 */
export declare const PARAKEET_PUNCTUATION: readonly string[];
export interface ParakeetSpan {
    readonly tokens: readonly string[];
    readonly timestamps: readonly number[];
}
export interface ParakeetChunkText {
    readonly puncInput: string;
    readonly punctuation: {
        readonly ids: readonly number[];
        readonly list: readonly string[];
    };
    readonly rawText: string;
    readonly timestampsMs: readonly (readonly [number, number])[];
    readonly tokens: readonly string[];
    readonly words: readonly string[];
}
/**
 * Builds the word-level view of one speech chunk. Offsets are relative to the
 * chunk so the shared block and token-unit builders can place them on the
 * meeting timeline.
 */
export declare function parakeetChunkText(span: ParakeetSpan, durationMs: number): ParakeetChunkText;
