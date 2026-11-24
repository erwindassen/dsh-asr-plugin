/**
 * Speaker attribution is a presentation concern. A committed transcript keeps the
 * labeler's labels forever; a user-supplied name only ever replaces the label
 * surface of an export (or of the OKF transcript copy). This module is the single
 * place that decides what a name means, so the panel, the export control and the
 * bundle copy cannot disagree.
 */
/** Longest name a text field may produce, counted in code points. */
export const SPEAKER_NAME_MAX_LENGTH = 60;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/gu;
const WHITESPACE = /\s+/gu;
/**
 * Canonical form of a typed name: control characters and line breaks become
 * spaces, whitespace runs collapse, the result is trimmed and capped. Applying
 * this twice changes nothing, which is what lets the host reject any value that
 * is not already canonical.
 */
export function normalizeSpeakerName(raw) {
    const collapsed = raw.replace(CONTROL_CHARACTERS, " ").replace(WHITESPACE, " ").trim();
    return Array.from(collapsed).slice(0, SPEAKER_NAME_MAX_LENGTH).join("").trim();
}
/** The name to print for a label: the assigned name, or the label itself. */
export function speakerNameFor(label, names) {
    const name = normalizeSpeakerName(names[label] ?? "");
    return name === "" ? label : name;
}
/** Only the assignments that actually rename something. */
export function assignedSpeakerNames(labels, names) {
    const assigned = {};
    for (const label of labels) {
        const name = speakerNameFor(label, names);
        if (name !== label)
            assigned[label] = name;
    }
    return assigned;
}
/** Names that more than one label resolves to, in first-seen order. */
export function duplicateSpeakerNames(labels, names) {
    const counts = new Map();
    for (const label of labels) {
        const name = speakerNameFor(label, names);
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts].filter(([, count]) => count > 1).map(([name]) => name);
}
/**
 * Validates a map on its way in. A name must be already canonical (so nothing is
 * silently rewritten on the way out), and two labels may not share a name.
 */
export function speakerNameProblems(labels, names) {
    const known = new Set(labels);
    const problems = [];
    for (const [label, raw] of Object.entries(names)) {
        if (!known.has(label)) {
            problems.push({ kind: "unknown-label", label });
            continue;
        }
        if (normalizeSpeakerName(raw) === "")
            continue;
        if (normalizeSpeakerName(raw) !== raw) {
            problems.push({ kind: "invalid-name", label });
        }
    }
    for (const name of duplicateSpeakerNames(labels, names)) {
        problems.push({ kind: "duplicate-name", name });
    }
    return problems;
}
//# sourceMappingURL=speaker-attribution.js.map