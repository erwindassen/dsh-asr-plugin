import { isValidElement, type ReactElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

// The view is invoked as a plain function here, so stateful hooks need stubs.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useCallback: (callback: unknown) => callback,
  useEffect: vi.fn(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
}));

vi.mock("@deepseek-ai/dsh-client-ui-primitives", () => ({
  Button: () => null, Tooltip: () => null, StateDot: () => null,
  IconWarningOutlineRegular: () => null, IconRefreshOutlineRegular: () => null,
}));
vi.mock("../../src/client/use-recording-panel-layout.js", () => ({
  useRecordingPanelLayout: () => ({ expanded: true, style: {}, move: {}, resize: {},
    toggle: vi.fn(), reset: vi.fn() }),
}));

import { RecordingPanelView, canIngest, type PanelViewProps } from "../../src/client/RecordingPanelView.js";
import type {
  IngestionFailure,
  MeetingIngestion,
  StoredMeetings,
  StoredMeetingsSync,
} from "../../src/client/use-stored-meetings.js";
import type { RecordingRpcView, StoredMeetingRpcEntry } from "../../src/recording/rpc-contract.js";

const deviceProps = {
  devices: null,
  refreshDevices: vi.fn(),
  selectDevice: vi.fn(),
  selectedDevices: { mic: "", system: "" },
};

const translate = (key: string, params?: Readonly<Record<string, string>>): string =>
  params === undefined ? key : `${key}:${Object.values(params).join(",")}`;

const entry: StoredMeetingRpcEntry = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  title: "Weekly review",
  started_at: "2026-02-03T09:00:00.000Z",
  duration_ms: 1_200_000,
  transcript_version: 2,
  status: "completed",
  ingested_transcript_version: 2,
};

const recordingView = {
  draftRevision: 0, draftStale: false, errorCode: null, finalizationMs: null, jobId: "job",
  latestAudioAtMs: null, latestDraftAtMs: null, meetingId: "meeting",
  mic: { state: "on", requested: true, errorCode: null },
  system: { state: "on", requested: true, errorCode: null }, phase: "recording",
  recordingEndedAtMs: null, recordingElapsedMs: 100, recordingStartedAtMs: 1,
  durationMs: null, resultStatus: null, transcriptVersion: null,
} as const satisfies RecordingRpcView;

const transcript = {
  meeting_id: entry.meeting_id, title: entry.title, transcript_version: 2, duration_ms: 1_200_000,
  segments: [{ seq: 0, startMs: 0, endMs: 1_000, speakerLabel: "Speaker A", text: "Stored segment text" }],
};

function sync(overrides: Partial<StoredMeetingsSync> = {}): StoredMeetingsSync {
  return {
    pending: null, busy: false, failure: null, removed: null,
    request: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), ...overrides,
  };
}

function storedMeetings(overrides: Partial<StoredMeetings> = {}): StoredMeetings {
  return {
    entries: [entry], loading: false, error: null, selected: entry, transcript,
    transcriptLoading: false, transcriptError: null, disabled: false,
    select: vi.fn(), clear: vi.fn(), reload: vi.fn(), sync: sync(), ...overrides,
  };
}

function ingestion(overrides: Partial<MeetingIngestion> = {}): MeetingIngestion {
  return { running: false, outcome: null, failure: null, start: vi.fn(), ...overrides };
}

function props(overrides: Partial<PanelViewProps> = {}): PanelViewProps {
  return {
    hasRecordingHistory: false, failure: null, join: vi.fn(), pending: false, pendingAction: null,
    preview: [], run: vi.fn(), translate, view: null, ...deviceProps,
    storedMeetings: storedMeetings(), ingestion: ingestion(), stored: { version: 2 }, ...overrides,
  };
}

function findElement(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean):
ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<Record<string, unknown>>;
  if (predicate(element)) return element;
  // Children first: a mocked component renders null, so walking its output
  // would hide the elements it wraps.
  const child = findElement(element.props.children as ReactNode, predicate);
  if (child !== undefined) return child;
  if (typeof element.type === "function") {
    return findElement((element.type as (value: unknown) => ReactNode)(element.props), predicate);
  }
  return undefined;
}

function ingestButton(overrides: Partial<PanelViewProps>) {
  const button = findElement(RecordingPanelView(props(overrides)), element =>
    element.props["aria-label"] === "panel.ingest" || element.props["aria-label"] === "panel.ingesting");
  if (button === undefined) throw new Error("missing ingest button");
  return button.props;
}

function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    return text((element.type as (value: unknown) => ReactNode)(element.props));
  }
  return text(element.props.children as ReactNode);
}

it("keeps ingest disabled until a committed transcript is selected", () => {
  const loaded = storedMeetings();
  expect(canIngest(props({ storedMeetings: loaded }))).toBe(true);
  expect(ingestButton({ storedMeetings: loaded }).disabled).toBe(false);

  expect(ingestButton({ storedMeetings: storedMeetings({ selected: null, transcript: null }) }).disabled).toBe(true);
  expect(canIngest(props({ storedMeetings: storedMeetings({ selected: null, transcript: null }) }))).toBe(false);
});

it("ingests the panel's own meeting once its transcript is committed", () => {
  const idle = { ...recordingView, phase: "completed", resultStatus: "completed", transcriptVersion: 1 } as const;
  expect(canIngest(props({
    view: idle, storedMeetings: storedMeetings({ selected: null, transcript: null }),
  }))).toBe(true);
  const draftOnly = { ...recordingView, phase: "cancelled", transcriptVersion: null } as const;
  expect(canIngest(props({
    view: draftOnly, storedMeetings: storedMeetings({ selected: null, transcript: null }),
  }))).toBe(false);
});

it("keeps ingest disabled while a recording owns the panel", () => {
  const overrides = { view: recordingView };
  expect(canIngest(props(overrides))).toBe(false);
  expect(ingestButton(overrides).disabled).toBe(true);
});

it("keeps ingest disabled while a transcript is loading, a previous run is active or the panel is busy", () => {
  expect(canIngest(props({ storedMeetings: storedMeetings({ transcriptLoading: true, transcript: null }) }))).toBe(false);
  expect(canIngest(props({ ingestion: ingestion({ running: true }) }))).toBe(false);
  expect(canIngest(props({ pending: true }))).toBe(false);
  expect(canIngest(props({ storedMeetings: storedMeetings({ transcriptError: "LOAD_FAILED", transcript: null }) }))).toBe(false);
  expect(canIngest(props({ storedMeetings: undefined }))).toBe(false);
});

it("shows a read-only committed transcript with its version instead of the live draft", () => {
  const result = RecordingPanelView(props({ preview: transcript.segments, stored: { version: 2 } }));
  const rendered = text(result);
  expect(rendered).toContain("Stored segment text");
  expect(rendered).toContain("panel.storedTitle");
  expect(rendered).toContain("panel.storedVersion:2");
  expect(rendered).toContain("panel.storedHint");
});

it("lists saved meetings with a marker only when that version is ingested", () => {
  const select = vi.fn();
  const result = RecordingPanelView(props({ storedMeetings: storedMeetings({ select }) }));
  const rendered = text(result);
  expect(rendered).toContain("Weekly review");
  expect(rendered).toContain("panel.storedIngested");
  const newer = { ...entry, transcript_version: 3, ingested_transcript_version: 2 };
  const stale = text(RecordingPanelView(props({ storedMeetings: storedMeetings({ entries: [newer], selected: null }) })));
  expect(stale).toContain("Weekly review");
  expect(stale).not.toContain("panel.storedIngested");
  const row = findElement(RecordingPanelView(props({ storedMeetings: storedMeetings({ select }) })), element =>
    element.props.role === "option");
  (row?.props.onClick as () => void)();
  expect(select).toHaveBeenCalledWith(entry);
});

it("disables saved meeting rows while recording and marks a short load failure", () => {
  const row = findElement(RecordingPanelView(props({
    view: recordingView, storedMeetings: storedMeetings({ disabled: true }),
  })), element => element.props.role === "option");
  expect(row?.props.disabled).toBe(true);
  const failed = text(RecordingPanelView(props({
    storedMeetings: storedMeetings({ entries: [], error: "LOAD_FAILED", selected: null, transcript: null }),
  })));
  expect(failed).toContain("panel.storedLoadFailed");
  const empty = text(RecordingPanelView(props({
    storedMeetings: storedMeetings({ entries: [], selected: null, transcript: null }),
  })));
  expect(empty).toContain("panel.storedEmpty");
});

it("reports ingestion success without exposing paths or transcript text", () => {
  const rendered = text(RecordingPanelView(props({ ingestion: ingestion({ outcome: "succeeded" }) })));
  expect(rendered).toContain("panel.ingested");
});

it.each([
  ["notConfigured", "panel.ingestNotConfigured"],
  ["busy", "panel.ingestBusy"],
  ["timeout", "panel.ingestTimeout"],
  ["unavailable", "panel.ingestFailed"],
] satisfies Array<[IngestionFailure, string]>)("reports a %s ingestion failure with a short message", (failure, key) => {
  const rendered = text(RecordingPanelView(props({
    ingestion: ingestion({ outcome: "failed", failure }),
  })));
  expect(rendered).toContain(key);
  expect(rendered).not.toContain(failure === "busy" ? "OKF_BUSY" : "/private");
});

it("shows a busy ingest control while the run is active", () => {
  const button = ingestButton({ ingestion: ingestion({ running: true }) });
  expect(button["aria-label"]).toBe("panel.ingesting");
  expect(button["aria-busy"]).toBe(true);
  expect(button.disabled).toBe(true);
});

it("distinguishes a loading stored transcript from one that failed to load", () => {
  const loading = text(RecordingPanelView(props({ preview: [], stored: { version: null } })));
  expect(loading).toContain("panel.storedLoading");
  const failed = text(RecordingPanelView(props({ preview: [], stored: { failed: true, version: null } })));
  expect(failed).toContain("panel.storedLoadFailed");
  expect(failed).not.toContain("panel.storedLoading");
});

function control(overrides: Partial<PanelViewProps>, label: string) {
  const found = findElement(RecordingPanelView(props(overrides)), element =>
    element.props.children === label);
  if (found === undefined) throw new Error(`missing control: ${label}`);
  return found.props;
}

it("offers a sync control beside the saved meetings heading", () => {
  const button = control({}, "panel.sync");
  expect(button).toMatchObject({ disabled: false, "aria-busy": false });
  void (button.onClick as () => void)();
});

it("asks before removing the meetings the folder does not hold", () => {
  const pending = sync({ pending: 2 });
  const confirm = control({ storedMeetings: storedMeetings({ sync: pending }) }, "panel.syncConfirm:2");
  expect(confirm).toBeDefined();
  const remove = control({ storedMeetings: storedMeetings({ sync: pending }) }, "panel.syncRemove");
  const cancel = control({ storedMeetings: storedMeetings({ sync: pending }) }, "panel.syncCancel");
  expect(typeof remove.onClick).toBe("function");
  expect(typeof cancel.onClick).toBe("function");
});

it("reports when the folder already holds every stored meeting", () => {
  const rendered = text(RecordingPanelView(props({ storedMeetings: storedMeetings({ sync: sync({ pending: 0 }) }) })));
  expect(rendered).toContain("panel.syncNothing");
});

it("reports how many meetings a sync removed", () => {
  const rendered = text(RecordingPanelView(props({ storedMeetings: storedMeetings({ sync: sync({ removed: 3 }) }) })));
  expect(rendered).toContain("panel.syncDone:3");
});

it("names why a sync could not read the folder", () => {
  for (const [failure, key] of [["notConfigured", "panel.syncNotConfigured"],
    ["missingFolder", "panel.syncMissingFolder"], ["failed", "panel.syncFailed"]] as const) {
    const rendered = text(RecordingPanelView(props({ storedMeetings: storedMeetings({ sync: sync({ failure }) }) })));
    expect(rendered).toContain(key);
  }
});
