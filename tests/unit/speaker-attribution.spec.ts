import { describe, expect, it } from "vitest";

import {
  SPEAKER_NAME_MAX_LENGTH,
  assignedSpeakerNames,
  duplicateSpeakerNames,
  normalizeSpeakerName,
  speakerNameFor,
  speakerNameProblems,
} from "../../src/transcripts/speaker-attribution.js";

describe("normalizeSpeakerName", () => {
  it("trims, collapses whitespace and removes control characters", () => {
    expect(normalizeSpeakerName("  Alice \n\t Smith  ")).toBe("Alice Smith");
    expect(normalizeSpeakerName("a\u0000b\u2028c")).toBe("a b c");
  });

  it("is idempotent", () => {
    for (const raw of [" Alice ", "A\nB", 'Alice "Al"', "😀".repeat(SPEAKER_NAME_MAX_LENGTH + 5)]) {
      const once = normalizeSpeakerName(raw);
      expect(normalizeSpeakerName(once)).toBe(once);
    }
  });

  it("caps a name in code points without splitting surrogate pairs", () => {
    const raw = "😀".repeat(SPEAKER_NAME_MAX_LENGTH + 5);
    const name = normalizeSpeakerName(raw);
    expect(Array.from(name)).toHaveLength(SPEAKER_NAME_MAX_LENGTH);
    expect(name).toBe("😀".repeat(SPEAKER_NAME_MAX_LENGTH));
  });

  it("keeps the cue sentinel intact so the renderer stays responsible for it", () => {
    expect(normalizeSpeakerName("A --> B")).toBe("A --> B");
  });
});

describe("speakerNameFor", () => {
  it("falls back to the label for a missing or empty assignment", () => {
    expect(speakerNameFor("Speaker A", {})).toBe("Speaker A");
    expect(speakerNameFor("Speaker A", { "Speaker A": "" })).toBe("Speaker A");
    expect(speakerNameFor("Speaker A", { "Speaker A": "   " })).toBe("Speaker A");
  });

  it("normalizes an assigned name", () => {
    expect(speakerNameFor("Speaker A", { "Speaker A": " Alice " })).toBe("Alice");
    expect(speakerNameFor("Speaker A", { "Speaker A": "A\nB" })).toBe("A B");
  });
});

describe("assignedSpeakerNames", () => {
  it("keeps only assignments that actually rename a known label", () => {
    expect(assignedSpeakerNames(["Speaker A", "UNKNOWN"], {
      "Speaker A": "Alice",
      "Speaker B": "Bob",
      UNKNOWN: "UNKNOWN",
    })).toEqual({ "Speaker A": "Alice" });
  });

  it("returns an empty map for an identity map", () => {
    expect(assignedSpeakerNames(["Speaker A"], { "Speaker A": "Speaker A" })).toEqual({});
  });
});

describe("duplicateSpeakerNames", () => {
  it("reports a name shared by more than one label", () => {
    expect(duplicateSpeakerNames(["Speaker A", "Speaker B"], {
      "Speaker A": "Alice",
      "Speaker B": "Alice",
    })).toEqual(["Alice"]);
  });

  it("counts a kept label as a name", () => {
    expect(duplicateSpeakerNames(["Speaker A", "UNKNOWN"], { "Speaker A": "UNKNOWN" }))
      .toEqual(["UNKNOWN"]);
  });

  it("returns nothing for distinct or untouched labels", () => {
    expect(duplicateSpeakerNames(["Speaker A", "UNKNOWN"], {})).toEqual([]);
    expect(duplicateSpeakerNames(["Speaker A", "UNKNOWN"], {
      "Speaker A": "Alice",
      UNKNOWN: "Bob",
    })).toEqual([]);
  });
});

describe("speakerNameProblems", () => {
  it("rejects a label the transcript does not contain", () => {
    expect(speakerNameProblems(["Speaker A"], { "Speaker B": "Bob" }))
      .toEqual([{ kind: "unknown-label", label: "Speaker B" }]);
  });

  it("rejects a name that is not already canonical", () => {
    expect(speakerNameProblems(["Speaker A"], { "Speaker A": " Alice" }))
      .toEqual([{ kind: "invalid-name", label: "Speaker A" }]);
    expect(speakerNameProblems(["Speaker A"], { "Speaker A": "A\nB" }))
      .toEqual([{ kind: "invalid-name", label: "Speaker A" }]);
  });

  it("accepts an empty name as keep-the-label", () => {
    expect(speakerNameProblems(["Speaker A"], { "Speaker A": "" })).toEqual([]);
  });

  it("rejects duplicate names", () => {
    expect(speakerNameProblems(["Speaker A", "UNKNOWN"], {
      "Speaker A": "Alice",
      UNKNOWN: "Alice",
    })).toEqual([{ kind: "duplicate-name", name: "Alice" }]);
  });

  it("accepts a canonical, unique map", () => {
    expect(speakerNameProblems(["Speaker A", "UNKNOWN"], {
      "Speaker A": "Alice",
      UNKNOWN: "x".repeat(SPEAKER_NAME_MAX_LENGTH),
    })).toEqual([]);
  });

  it("rejects a name longer than the cap because it cannot be canonical", () => {
    expect(speakerNameProblems(["Speaker A"], { "Speaker A": "x".repeat(SPEAKER_NAME_MAX_LENGTH + 1) }))
      .toEqual([{ kind: "invalid-name", label: "Speaker A" }]);
  });
});
