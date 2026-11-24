import { describe, expect, it } from "vitest";

import type { CommittedTranscriptSnapshot } from "../../src/storage/meeting-repository.js";
import { renderTranscriptExport } from "../../src/transcript-projection/transcript-export-renderer.js";
import type { RenderTranscriptExportOptions } from "../../src/transcript-projection/transcript-export-renderer.js";
import type { TranscriptExportFormat } from "../../src/transcript-projection/transcript-projection.js";

const MEETING_ID = "11111111-1111-4111-8111-111111111111";
const EXPORTED_AT_MS = Date.parse("2026-09-01T02:03:04.005Z");

function snapshot(): CommittedTranscriptSnapshot {
  return {
    meeting: {
      runIdentity: null,
    transcriptIdentity: null,
    meetingId: MEETING_ID,
      origin: "recording",
      title: "产品周会",
      sourceName: "recording.wav",
      sourceFormat: "wav",
      sourceSizeBytes: 64_044,
      sourceSha256: "b".repeat(64),
      durationMs: 65_000,
      status: "partial",
      committedStatus: "partial",
      transcriptVersion: 3,
      resultReason: "unknown_speaker_segments",
      engineFingerprint: "a".repeat(64),
      activeRunId: null,
      runKind: null,
      errorCode: null,
      errorStage: null,
      createdAtMs: Date.parse("2026-09-01T01:00:00.000Z"),
      updatedAtMs: Date.parse("2026-09-01T01:02:00.000Z"),
      recordingStartedAtMs: Date.parse("2026-09-01T01:00:01.000Z"),
      recordingEndedAtMs: Date.parse("2026-09-01T01:01:10.000Z"),
    },
    segments: [
      { seq: 0, startMs: 0, endMs: 1_234, speakerLabel: "Speaker A", text: "你好，world。" },
      { seq: 1, startMs: 60_000, endMs: 65_000, speakerLabel: "UNKNOWN", text: "第二段。" },
    ],
  };
}

it("逐段确定性渲染 Markdown 和纯文本", () => {
  expect(renderTranscriptExport(snapshot(), {
    format: "md",
    exportedAtMs: EXPORTED_AT_MS,
    includeSpeakers: true,
    includeTimestamps: true,
  })).toBe(`# Meeting transcript

title: "产品周会"
meeting_id: "${MEETING_ID}"
transcript_version: 3
recording_started_at: "2026-09-01T01:00:01.000Z"
recording_ended_at: "2026-09-01T01:01:10.000Z"
duration_ms: 65000
exported_at: "2026-09-01T02:03:04.005Z"

## Segment 1

time: 00:00:00.000 --> 00:00:01.234
speaker: "Speaker A"

你好，world。

## Segment 2

time: 00:01:00.000 --> 00:01:05.000
speaker: "UNKNOWN"

第二段。
`);

  expect(renderTranscriptExport(snapshot(), {
    format: "txt",
    exportedAtMs: EXPORTED_AT_MS,
    includeSpeakers: false,
    includeTimestamps: false,
  })).toBe(`title: "产品周会"
meeting_id: "${MEETING_ID}"
transcript_version: 3
recording_started_at: "2026-09-01T01:00:01.000Z"
recording_ended_at: "2026-09-01T01:01:10.000Z"
duration_ms: 65000
exported_at: "2026-09-01T02:03:04.005Z"

---

你好，world。

第二段。
`);
});

it("逐段确定性渲染标准 SRT 和带来源 NOTE 的 VTT", () => {
  expect(renderTranscriptExport(snapshot(), {
    format: "srt",
    exportedAtMs: EXPORTED_AT_MS,
    includeSpeakers: true,
    includeTimestamps: true,
  })).toBe(`1
00:00:00,000 --> 00:00:01,234
Speaker A
你好，world。

2
00:01:00,000 --> 00:01:05,000
UNKNOWN
第二段。
`);

  expect(renderTranscriptExport(snapshot(), {
    format: "vtt",
    exportedAtMs: EXPORTED_AT_MS,
    includeSpeakers: false,
    includeTimestamps: true,
  })).toBe(`WEBVTT

NOTE
title: "产品周会"
meeting_id: "${MEETING_ID}"
transcript_version: 3
recording_started_at: "2026-09-01T01:00:01.000Z"
recording_ended_at: "2026-09-01T01:01:10.000Z"
duration_ms: 65000
exported_at: "2026-09-01T02:03:04.005Z"

00:00:00.000 --> 00:00:01.234
你好，world。

00:01:00.000 --> 00:01:05.000
第二段。
`);
});

const FORMATS: readonly TranscriptExportFormat[] = ["md", "txt", "srt", "vtt"];

function options(format: TranscriptExportFormat): RenderTranscriptExportOptions {
  return {
    format,
    exportedAtMs: EXPORTED_AT_MS,
    includeSpeakers: true,
    includeTimestamps: true,
  };
}

function withText(text: string): CommittedTranscriptSnapshot {
  const value = snapshot();
  return {
    ...value,
    segments: [{ ...value.segments[0]!, text }, value.segments[1]!],
  };
}

describe("speaker names in exports", () => {
  it("keeps every format byte-identical for an identity or empty map", () => {
    const identity = { "Speaker A": "Speaker A", UNKNOWN: "UNKNOWN" };
    for (const format of FORMATS) {
      const plain = renderTranscriptExport(snapshot(), options(format));
      expect(renderTranscriptExport(snapshot(), { ...options(format), speakerNames: identity })).toBe(plain);
      expect(renderTranscriptExport(snapshot(), { ...options(format), speakerNames: {} })).toBe(plain);
    }
  });

  it("changes exactly the speaker label line when a speaker is renamed", () => {
    const expectedChanges: Record<TranscriptExportFormat, readonly [string, string]> = {
      md: ['speaker: "Speaker A"', 'speaker: "Alice"'],
      txt: ["[00:00:00.000 --> 00:00:01.234] [Speaker A]", "[00:00:00.000 --> 00:00:01.234] [Alice]"],
      srt: ["Speaker A", "Alice"],
      vtt: ["Speaker A", "Alice"],
    };
    for (const format of FORMATS) {
      const before = renderTranscriptExport(snapshot(), options(format)).split("\n");
      const after = renderTranscriptExport(snapshot(), {
        ...options(format),
        speakerNames: { "Speaker A": "Alice" },
      }).split("\n");
      expect(after).toHaveLength(before.length);
      const changes = before.flatMap((line, index) => line === after[index] ? [] : [[line, after[index]]]);
      expect(changes).toEqual([expectedChanges[format]]);
    }
  });

  it("never rewrites a label string that appears in segment text", () => {
    for (const format of FORMATS) {
      const output = renderTranscriptExport(withText("Speaker A said hello"), {
        ...options(format),
        speakerNames: { "Speaker A": "Alice" },
      });
      expect(output).toContain("Speaker A said hello");
      expect(output).not.toContain("Alice said hello");
    }
  });

  it("escapes quotes and collapses line breaks in a Markdown name", () => {
    const output = renderTranscriptExport(snapshot(), {
      ...options("md"),
      speakerNames: { "Speaker A": 'Alice "Al"\nSmith' },
    });
    expect(output).toContain('speaker: "Alice \\"Al\\" Smith"');
    expect(output).not.toContain("Alice \"Al\"\nSmith");
  });

  it("collapses line breaks in plain-text and subtitle names", () => {
    const names = { "Speaker A": "Alice\nSmith" };
    expect(renderTranscriptExport(snapshot(), { ...options("txt"), speakerNames: names }))
      .toContain("[00:00:00.000 --> 00:00:01.234] [Alice Smith]");
    expect(renderTranscriptExport(snapshot(), { ...options("srt"), speakerNames: names }))
      .toContain("Alice Smith\n你好，world。");
    expect(renderTranscriptExport(snapshot(), { ...options("vtt"), speakerNames: names }))
      .toContain("Alice Smith\n你好，world。");
  });

  it("rewrites the subtitle cue sentinel inside an assigned name only", () => {
    const names = { "Speaker A": "A --> B" };
    const srt = renderTranscriptExport(snapshot(), { ...options("srt"), speakerNames: names });
    const vtt = renderTranscriptExport(snapshot(), { ...options("vtt"), speakerNames: names });
    expect(srt).toContain("A \u2192 B\n");
    expect(srt).not.toContain("A --> B");
    expect(vtt).toContain("A \u2192 B\n");
    expect(vtt).not.toContain("A --> B");
    expect(srt).toContain("00:00:00,000 --> 00:00:01,234");
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.234");
  });

  it("leaves output untouched when speakers are excluded", () => {
    for (const format of FORMATS) {
      const withoutSpeakers: RenderTranscriptExportOptions = {
        ...options(format),
        includeSpeakers: false,
      };
      expect(renderTranscriptExport(snapshot(), {
        ...withoutSpeakers,
        speakerNames: { "Speaker A": "Alice" },
      })).toBe(renderTranscriptExport(snapshot(), withoutSpeakers));
    }
  });
});
