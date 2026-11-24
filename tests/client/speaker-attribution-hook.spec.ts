import { expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  cells: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<{
    effect: () => (() => void) | undefined;
    deps?: readonly unknown[] | undefined;
  }>,
  cursor: 0,
  refCursor: 0,
}));

// Hooks are driven directly here: state cells and effects are recorded so a
// re-render can be requested explicitly and effect dependencies are compared
// the way React compares them.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | undefined, deps?: readonly unknown[]) => {
    harness.effects.push({ effect, deps });
  },
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => {
    const index = harness.refCursor++;
    if (harness.refs.length <= index) harness.refs.push({ current: value });
    return harness.refs[index]!;
  },
  useState: (value: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.cells)) harness.cells[index] = { value };
    const cell = harness.cells[index] as { value: unknown };
    const set = (next: unknown) => {
      cell.value = typeof next === "function" ? (next as (previous: unknown) => unknown)(cell.value) : next;
    };
    return [cell.value, set] as const;
  },
}));

vi.mock("../../src/client/RecordingPanelView.js", () => ({ RecordingPanelView: () => null }));

import { useSpeakerAttribution, useTranscriptExport } from "../../src/client/RecordingPanel.js";
import type { RecordingRpcClient } from "../../src/client/recording-rpc-client.js";
import type { MeetingReferenceLocaleKey } from "../../src/client/meeting-reference-locales.js";
import type { RecordingRpcView, TranscriptExportRpcPayload } from "../../src/recording/rpc-contract.js";

type Attribution = ReturnType<typeof useSpeakerAttribution>;
type Options = Parameters<typeof useSpeakerAttribution>[0];

const slots: Array<{
  deps?: readonly unknown[] | undefined;
  cleanup?: (() => void) | undefined;
}> = [];

function unmount(): void {
  for (const slot of [...slots].reverse()) slot.cleanup?.();
  slots.length = 0;
}

function flushEffects(): void {
  const pending = harness.effects.splice(0);
  pending.forEach((entry, index) => {
    const slot = slots[index] ?? (slots[index] = {});
    const unchanged = entry.deps !== undefined && slot.deps !== undefined &&
      entry.deps.length === slot.deps.length &&
      entry.deps.every((dep, position) => Object.is(dep, slot.deps![position]));
    if (unchanged) return;
    slot.cleanup?.();
    slot.deps = entry.deps;
    slot.cleanup = entry.effect();
  });
}

function render(options: Options): Attribution {
  harness.cursor = 0;
  harness.refCursor = 0;
  const result = useSpeakerAttribution(options);
  flushEffects();
  return result;
}

function reset(): void {
  unmount();
  harness.cells.length = 0;
  harness.refs.length = 0;
  harness.effects.length = 0;
  vi.useRealTimers();
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function fakeClient(overrides: Partial<Record<"speakerNames" | "saveSpeakerNames", unknown>> = {}) {
  return {
    speakerNames: vi.fn(async () => ({ speaker_names: {} })),
    saveSpeakerNames: vi.fn(async (payload: { speaker_names: Readonly<Record<string, string>> }) =>
      ({ speaker_names: payload.speaker_names })),
    ...overrides,
  } as unknown as RecordingRpcClient;
}

function options(client: RecordingRpcClient, overrides: Partial<Options> = {}): Options {
  return { client, labels: ["Speaker A", "Speaker B"], meetingId: "meeting-1",
    mounted: { current: true }, ...overrides };
}

it("loads the stored names for the current meeting", async () => {
  reset();
  const speakerNames = vi.fn(async () => ({ speaker_names: { "Speaker A": "Erwin" } }));
  const client = fakeClient({ speakerNames });
  const handle = options(client);
  expect(render(handle).names).toEqual({});
  await flush();
  const loaded = render(handle);
  expect(speakerNames).toHaveBeenCalledWith({ meeting_id: "meeting-1" }, expect.any(AbortSignal));
  expect(loaded.names).toEqual({ "Speaker A": "Erwin" });
  expect(loaded.labels).toEqual(["Speaker A", "Speaker B"]);
});

it("debounces a save to the renamed labels only and skips unchanged names", async () => {
  reset();
  vi.useFakeTimers();
  const saveSpeakerNames = vi.fn(async (payload: { speaker_names: Readonly<Record<string, string>> }) =>
    ({ speaker_names: payload.speaker_names }));
  const client = fakeClient({ saveSpeakerNames });
  const handle = options(client);
  render(handle);
  await vi.advanceTimersByTimeAsync(0);
  const ready = render(handle);
  ready.update("Speaker A", "Erwin");
  render(handle);
  expect(saveSpeakerNames).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(400);
  expect(saveSpeakerNames).toHaveBeenCalledTimes(1);
  expect(saveSpeakerNames.mock.calls[0]![0]).toEqual({
    meeting_id: "meeting-1", speaker_names: { "Speaker A": "Erwin" },
  });

  const saved = render(handle);
  saved.update("Speaker A", " Erwin ");
  render(handle);
  await vi.advanceTimersByTimeAsync(400);
  expect(saveSpeakerNames).toHaveBeenCalledTimes(1);
});

it("reports a failed save instead of swallowing it", async () => {
  reset();
  vi.useFakeTimers();
  const saveSpeakerNames = vi.fn(async () => { throw new Error("UNKNOWN_ENDPOINT"); });
  const handle = options(fakeClient({ saveSpeakerNames }));
  render(handle);
  await vi.advanceTimersByTimeAsync(0);
  const ready = render(handle);
  ready.update("Speaker A", "Erwin");
  render(handle);
  await vi.advanceTimersByTimeAsync(400);
  await vi.advanceTimersByTimeAsync(0);
  const failed = render(handle);
  expect(failed.failure).toEqual({ action: "save", code: "UNKNOWN_ENDPOINT" });
  expect(failed.saving).toBe(false);
});

it("reports a failed load so the section can show it", async () => {
  reset();
  const speakerNames = vi.fn(async () => { throw new Error("UNKNOWN_ENDPOINT"); });
  const handle = options(fakeClient({ speakerNames }));
  render(handle);
  await flush();
  expect(render(handle).failure).toEqual({ action: "load", code: "UNKNOWN_ENDPOINT" });
});

it("aborts the in-flight load when the meeting changes", () => {
  reset();
  const signals: AbortSignal[] = [];
  const speakerNames = vi.fn((_payload: unknown, signal?: AbortSignal) => {
    signals.push(signal!);
    return new Promise<never>(() => {});
  });
  const client = fakeClient({ speakerNames });
  render(options(client));
  render(options(client, { meetingId: "meeting-2" }));
  expect(signals).toHaveLength(2);
  expect(signals[0]!.aborted).toBe(true);
  expect(signals[1]!.aborted).toBe(false);
});

it("aborts pending work when the panel unmounts", () => {
  reset();
  const signals: AbortSignal[] = [];
  const speakerNames = vi.fn((_payload: unknown, signal?: AbortSignal) => {
    signals.push(signal!);
    return new Promise<never>(() => {});
  });
  const mounted = { current: true };
  render(options(fakeClient({ speakerNames }), { mounted }));
  mounted.current = false;
  unmount();
  expect(signals[0]!.aborted).toBe(true);
});

const recordingView = {
  draftRevision: 0, draftStale: false, errorCode: null, finalizationMs: null, jobId: "job",
  latestAudioAtMs: null, latestDraftAtMs: null, meetingId: "meeting-1",
  mic: { state: "on", requested: true, errorCode: null },
  system: { state: "on", requested: true, errorCode: null },
  phase: "completed", recordingEndedAtMs: 1_000, recordingElapsedMs: 1_000,
  recordingStartedAtMs: 0, durationMs: 1_000, resultStatus: null, transcriptVersion: 1,
} as const satisfies RecordingRpcView;

function exportOptions(speakerNames: Readonly<Record<string, string>>) {
  const exportTranscript = vi.fn(async (payload: TranscriptExportRpcPayload) =>
    ({ output_path: "/tmp/meeting-1.md", payload }));
  return {
    exportTranscript,
    options: {
      client: { exportTranscript } as unknown as RecordingRpcClient,
      labels: ["Speaker A"] as readonly string[],
      mounted: { current: true },
      setError: vi.fn(),
      setNotice: vi.fn(),
      setPending: vi.fn(),
      settings: undefined,
      speakerNames,
      translate: ((key: MeetingReferenceLocaleKey) => key) as (key: MeetingReferenceLocaleKey) => string,
      view: recordingView,
    },
  };
}

it("exports without speaker_names when no speaker is renamed", async () => {
  reset();
  const { exportTranscript, options: handle } = exportOptions({});
  await useTranscriptExport(handle)(false);
  const payload = exportTranscript.mock.calls[0]![0];
  expect(payload).not.toHaveProperty("speaker_names");
  expect(payload).toMatchObject({
    destination: "default", format: "md", include_speakers: true,
    include_timestamps: true, meeting_id: "meeting-1",
  });
});

it("sends assigned speaker_names only when a speaker is renamed", async () => {
  reset();
  const { exportTranscript, options: handle } = exportOptions({ "Speaker A": "Erwin", "Speaker B": "Bea" });
  await useTranscriptExport(handle)(true);
  const payload = exportTranscript.mock.calls[0]![0];
  expect(payload.speaker_names).toEqual({ "Speaker A": "Erwin" });
  expect(payload.destination).toBe("choose");
});
