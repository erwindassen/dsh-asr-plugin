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

// Hooks are driven directly: state cells, refs and effects are recorded so a
// re-render and effect deps can be reproduced without a renderer.
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

import {
  INGEST_POLL_ATTEMPTS,
  INGEST_POLL_MS,
  useMeetingIngestion,
} from "../../src/client/use-stored-meetings.js";
import type { RecordingRpcClient } from "../../src/client/recording-rpc-client.js";
import type { OkfIngestRpcValue } from "../../src/recording/rpc-contract.js";

type Ingestion = ReturnType<typeof useMeetingIngestion>;
type Options = Parameters<typeof useMeetingIngestion>[0];

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

function render(options: Options): Ingestion {
  harness.cursor = 0;
  harness.refCursor = 0;
  const result = useMeetingIngestion(options);
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

function status(state: OkfIngestRpcValue["state"], extra: Partial<OkfIngestRpcValue> = {}): OkfIngestRpcValue {
  return { job_id: "job-1", state, transcript_version: 3, error_code: null, message: null, ...extra };
}

function client(overrides: {
  readonly ingestMeeting?: ReturnType<typeof vi.fn>;
  readonly ingestionStatus?: ReturnType<typeof vi.fn>;
} = {}) {
  const ingestMeeting = overrides.ingestMeeting ?? vi.fn(async () => status("running"));
  const ingestionStatus = overrides.ingestionStatus ?? vi.fn(async () => status("succeeded"));
  return {
    client: { ingestMeeting, ingestionStatus } as unknown as RecordingRpcClient,
    ingestMeeting,
    ingestionStatus,
  };
}

function options(value: RecordingRpcClient, overrides: Partial<Options> = {}): Options {
  return { client: value, meetingId: "meeting-1", mounted: { current: true }, ...overrides };
}

it("polls a running ingestion to success and reports it once", async () => {
  reset();
  vi.useFakeTimers();
  const rpc = client({ ingestionStatus: vi.fn(async () => status("running"))
    .mockResolvedValueOnce(status("running")).mockResolvedValueOnce(status("succeeded")) });
  const onIngested = vi.fn();
  const handle = options(rpc.client, { onIngested });
  const idle = render(handle);
  expect(idle.running).toBe(false);
  idle.start();
  expect(render(handle).running).toBe(true);
  expect(rpc.ingestMeeting).toHaveBeenCalledWith({ meeting_id: "meeting-1" }, expect.any(AbortSignal));
  await vi.advanceTimersByTimeAsync(INGEST_POLL_MS);
  await vi.advanceTimersByTimeAsync(INGEST_POLL_MS);
  const settled = render(handle);
  expect(settled).toMatchObject({ running: false, outcome: "succeeded", failure: null });
  expect(onIngested).toHaveBeenCalledWith("meeting-1");
});

it("reports a short failure category without exposing the RPC error text", async () => {
  reset();
  vi.useFakeTimers();
  const rpc = client({ ingestMeeting: vi.fn(async () => { throw new Error("OKF_BUSY"); }) });
  const handle = options(rpc.client);
  render(handle).start();
  await vi.advanceTimersByTimeAsync(0);
  expect(render(handle)).toMatchObject({ running: false, outcome: "failed", failure: "busy" });
});

it("classifies a missing knowledge base and a failed attempt", async () => {
  reset();
  vi.useFakeTimers();
  const rpc = client({ ingestionStatus: vi.fn(async () => status("failed", { error_code: "OKF_NOT_CONFIGURED" })) });
  const handle = options(rpc.client);
  render(handle).start();
  await vi.advanceTimersByTimeAsync(INGEST_POLL_MS);
  expect(render(handle)).toMatchObject({ outcome: "failed", failure: "notConfigured" });
});

it("stops polling after the bounded attempt budget and reports a timeout", async () => {
  reset();
  vi.useFakeTimers();
  const ingestionStatus = vi.fn(async () => status("running"));
  const rpc = client({ ingestionStatus });
  const handle = options(rpc.client);
  render(handle).start();
  await vi.advanceTimersByTimeAsync(INGEST_POLL_MS * (INGEST_POLL_ATTEMPTS + 1));
  expect(render(handle)).toMatchObject({ outcome: "failed", failure: "timeout" });
  expect(ingestionStatus).toHaveBeenCalledTimes(INGEST_POLL_ATTEMPTS);
});

it("does nothing without a selected meeting", async () => {
  reset();
  const rpc = client();
  const handle = options(rpc.client, { meetingId: null });
  render(handle).start();
  await Promise.resolve();
  expect(rpc.ingestMeeting).not.toHaveBeenCalled();
});

it("cancels an in-flight attempt when the selection changes", async () => {
  reset();
  vi.useFakeTimers();
  const rpc = client({ ingestionStatus: vi.fn(async () => status("succeeded")) });
  const handle = options(rpc.client);
  render(handle).start();
  render({ ...handle, meetingId: "meeting-2" });
  await vi.advanceTimersByTimeAsync(INGEST_POLL_MS * 2);
  const settled = render({ ...handle, meetingId: "meeting-2" });
  expect(settled).toMatchObject({ running: false, outcome: null, failure: null });
  expect(rpc.ingestionStatus).not.toHaveBeenCalled();
});
