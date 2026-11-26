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

import { useStoredMeetings } from "../../src/client/use-stored-meetings.js";
import type { RecordingRpcClient } from "../../src/client/recording-rpc-client.js";
import type {
  StoredMeetingRpcEntry,
  StoredMeetingTranscriptRpcValue,
} from "../../src/recording/rpc-contract.js";

type Stored = ReturnType<typeof useStoredMeetings>;
type Options = Parameters<typeof useStoredMeetings>[0];

const slots: Array<{ deps?: readonly unknown[] | undefined; cleanup?: (() => void) | undefined }> = [];

function unmount(): void {
  for (const slot of [...slots].reverse()) slot.cleanup?.();
  slots.length = 0;
}

function flushEffects(): void {
  const pending = harness.effects.splice(0);
  pending.forEach((entry, index) => {
    const slot = slots[index] ?? (slots[index] = {});
    const unchanged = entry.deps !== undefined && slot.deps !== undefined
      && entry.deps.length === slot.deps.length
      && entry.deps.every((dep, position) => Object.is(dep, slot.deps![position]));
    if (unchanged) return;
    slot.cleanup?.();
    slot.deps = entry.deps;
    slot.cleanup = entry.effect();
  });
}

function render(options: Options): Stored {
  harness.cursor = 0;
  harness.refCursor = 0;
  const result = useStoredMeetings(options);
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

const entry: StoredMeetingRpcEntry = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  title: "Weekly review",
  started_at: "2026-02-03T09:00:00.000Z",
  duration_ms: 1_200_000,
  transcript_version: 2,
  status: "completed",
  ingested_transcript_version: 1,
};

const transcript: StoredMeetingTranscriptRpcValue = {
  meeting_id: entry.meeting_id,
  title: entry.title,
  transcript_version: 2,
  duration_ms: entry.duration_ms,
  segments: [
    { seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "Stored segment text" },
  ],
};

function client(options: {
  readonly listMeetings?: ReturnType<typeof vi.fn>;
  readonly meetingTranscript?: ReturnType<typeof vi.fn>;
} = {}) {
  const listMeetings = options.listMeetings ?? vi.fn(async () => [entry]);
  const meetingTranscript = options.meetingTranscript ?? vi.fn(async () => transcript);
  return {
    client: { listMeetings, meetingTranscript } as unknown as RecordingRpcClient,
    listMeetings,
    meetingTranscript,
  };
}

function options(value: RecordingRpcClient, overrides: Partial<Options> = {}): Options {
  return { active: false, client: value, mounted: { current: true }, ...overrides };
}

it("lists committed meetings and marks loading until they arrive", async () => {
  reset();
  const rpc = client();
  const handle = options(rpc.client);
  expect(render(handle).loading).toBe(true);
  await Promise.resolve();
  const loaded = render(handle);
  expect(loaded.entries).toEqual([entry]);
  expect(loaded.loading).toBe(false);
  expect(loaded.error).toBeNull();
  expect(rpc.listMeetings).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
});

it("loads the selected meeting's committed segments", async () => {
  reset();
  const rpc = client();
  const mounted = { current: true };
  const base = options(rpc.client, { mounted });
  render(base);
  await Promise.resolve();
  render(base).select(entry);
  const pending = render(base);
  const loading = render(base);
  expect(pending.selected).toEqual(entry);
  expect(loading.transcriptLoading).toBe(true);
  await Promise.resolve();
  const loaded = render(base);
  expect(loaded.transcript).toEqual(transcript);
  expect(loaded.transcriptLoading).toBe(false);
  expect(rpc.meetingTranscript).toHaveBeenCalledWith({ meeting_id: entry.meeting_id }, expect.any(AbortSignal));
});

it("reports a transcript that cannot be read with a short failure marker", async () => {
  reset();
  const rpc = client({ meetingTranscript: vi.fn(async () => { throw new Error("MEETING_NOT_FOUND /private/path"); }) });
  const mounted = { current: true };
  const base = options(rpc.client, { mounted });
  render(base);
  await Promise.resolve();
  render(base).select(entry);
  render(base);
  await Promise.resolve();
  await Promise.resolve();
  expect(render(base).transcriptError).toBe("LOAD_FAILED");
});

it("clears the selection when a recording becomes active", async () => {
  reset();
  const rpc = client();
  const mounted = { current: true };
  const base = options(rpc.client, { mounted });
  render(base);
  await Promise.resolve();
  render(base).select(entry);
  expect(render(base).selected).toEqual(entry);
  render({ ...base, active: true });
  const recording = render({ ...base, active: true });
  expect(recording.selected).toBeNull();
  expect(recording.disabled).toBe(true);
  await Promise.resolve();
  expect(render({ ...base, active: true }).transcript).toBeNull();
});

it("reloads the list after an ingestion", async () => {
  reset();
  const rpc = client();
  const mounted = { current: true };
  const base = options(rpc.client, { mounted });
  render(base);
  await Promise.resolve();
  render(base).reload();
  render(base);
  await Promise.resolve();
  expect(rpc.listMeetings).toHaveBeenCalledTimes(2);
});
