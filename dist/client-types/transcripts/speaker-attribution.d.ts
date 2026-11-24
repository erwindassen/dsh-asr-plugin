/**
 * Speaker attribution is a presentation concern. A committed transcript keeps the
 * labeler's labels forever; a user-supplied name only ever replaces the label
 * surface of an export (or of the OKF transcript copy). This module is the single
 * place that decides what a name means, so the panel, the export control and the
 * bundle copy cannot disagree.
 */
/** Longest name a text field may produce, counted in code points. */
export declare const SPEAKER_NAME_MAX_LENGTH = 60;
/**
 * Label to display name. A missing label and an empty name both mean "keep the
 * label", so an untouched form is a no-op by construction.
 */
export type SpeakerNameMap = Readonly<Record<string, string>>;
/**
 * Canonical form of a typed name: control characters and line breaks become
 * spaces, whitespace runs collapse, the result is trimmed and capped. Applying
 * this twice changes nothing, which is what lets the host reject any value that
 * is not already canonical.
 */
export declare function normalizeSpeakerName(raw: string): string;
/** The name to print for a label: the assigned name, or the label itself. */
export declare function speakerNameFor(label: string, names: SpeakerNameMap): string;
/** Only the assignments that actually rename something. */
export declare function assignedSpeakerNames(labels: readonly string[], names: SpeakerNameMap): SpeakerNameMap;
/** Names that more than one label resolves to, in first-seen order. */
export declare function duplicateSpeakerNames(labels: readonly string[], names: SpeakerNameMap): readonly string[];
/** Everything wrong with a name map, judged against the labels of one transcript. */
export type SpeakerNameProblem = {
    readonly kind: "unknown-label";
    readonly label: string;
} | {
    readonly kind: "invalid-name";
    readonly label: string;
} | {
    readonly kind: "duplicate-name";
    readonly name: string;
};
/**
 * Validates a map on its way in. A name must be already canonical (so nothing is
 * silently rewritten on the way out), and two labels may not share a name.
 */
export declare function speakerNameProblems(labels: readonly string[], names: SpeakerNameMap): readonly SpeakerNameProblem[];
