import { isValidElement, type ReactNode } from "react";
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

import { RecordingPanelView } from "../../src/client/RecordingPanelView.js";
import type { SpeakerAttribution } from "../../src/client/RecordingPanel.js";
import { en, zh, type MeetingReferenceLocaleKey } from "../../src/client/meeting-reference-locales.js";
import type { RecordingRpcSegment } from "../../src/recording/rpc-contract.js";
import { SPEAKER_NAME_MAX_LENGTH } from "../../src/transcripts/speaker-attribution.js";

type Locale = Readonly<Record<MeetingReferenceLocaleKey, string>>;
type Element = {
  readonly type: unknown;
  readonly props: { readonly children?: ReactNode; readonly [key: string]: unknown };
};

const segments: readonly RecordingRpcSegment[] = [
  { seq: 0, startMs: 764_000, endMs: 768_000, speakerLabel: "Speaker A", text: "Hello there" },
  { seq: 1, startMs: 769_000, endMs: 772_000, speakerLabel: "Speaker B", text: "Hi" },
  { seq: 2, startMs: 773_000, endMs: 777_000, speakerLabel: "Speaker A", text: "Again" },
];

function localized(locale: Locale, key: MeetingReferenceLocaleKey,
  params?: Readonly<Record<string, string>>): string {
  let copy = locale[key];
  for (const [name, value] of Object.entries(params ?? {})) copy = copy.split(`{${name}}`).join(value);
  return copy;
}

function attribution(overrides: Partial<SpeakerAttribution> = {}): SpeakerAttribution {
  return { labels: ["Speaker A", "Speaker B"], names: {}, saving: false, failure: null,
    update: vi.fn(), ...overrides };
}

function panelProps(locale: Locale, attributionValue: SpeakerAttribution | undefined,
  preview: readonly RecordingRpcSegment[] = segments) {
  return {
    attribution: attributionValue,
    devices: null,
    exportNotice: null,
    exportTranscript: vi.fn(),
    failure: null,
    hasRecordingHistory: true,
    join: vi.fn(),
    pending: false,
    pendingAction: null,
    prepare: vi.fn(),
    preview,
    refreshDevices: vi.fn(),
    run: vi.fn(),
    selectDevice: vi.fn(),
    selectedDevices: { mic: "", system: "" },
    settings: undefined,
    settingsRevision: undefined,
    translate: (key: MeetingReferenceLocaleKey, params?: Readonly<Record<string, string>>) =>
      localized(locale, key, params),
    view: null,
  };
}

/** Every host element of the rendered tree, with function components expanded. */
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (typeof node.type === "function") {
    return elements((node.type as (props: unknown) => ReactNode)(node.props));
  }
  return [{ type: node.type, props: node.props as Element["props"] },
    ...elements(node.props.children)];
}

function elementText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(elementText).join(" ");
  if (typeof node === "string") return node;
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  if (typeof node.type === "function") {
    return elementText((node.type as (props: unknown) => ReactNode)(node.props));
  }
  return elementText(node.props.children);
}

/** Text of one element, without the joining spaces used to keep siblings apart. */
function inlineText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(inlineText).join("");
  if (typeof node === "string") return node;
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  return inlineText(node.props.children);
}

function speakerInputs(result: ReactNode): Element[] {
  return elements(result).filter(element => element.type === "input");
}

it.each([zh, en])("keeps the speaker attribution section closed by default", (locale: Locale) => {
  const result = RecordingPanelView(panelProps(locale, attribution()));
  const details = elements(result).filter(element => element.type === "details");
  expect(details).toHaveLength(1);
  expect(details[0]!.props.open).toBeUndefined();
  const text = elementText(details[0]!.props.children);
  expect(text).toContain(locale["panel.attribution"]);
  expect(text).toContain(locale["panel.attributionHint"]);
});

it("renders one input per distinct speaker label in first-appearance order", () => {
  const fields = speakerInputs(RecordingPanelView(panelProps(zh, attribution())));
  expect(fields).toHaveLength(2);
  expect(fields.map(field => field.props["aria-label"])).toEqual(["Speaker A", "Speaker B"]);
  expect(fields.map(field => field.props.placeholder)).toEqual(["Speaker A", "Speaker B"]);
  expect(fields.map(field => field.props.value)).toEqual(["", ""]);
  for (const field of fields) {
    expect(field.props.maxLength).toBe(SPEAKER_NAME_MAX_LENGTH);
    expect(field.props.spellCheck).toBe(false);
  }
});

it("renders nothing at all when no segment carries a speaker label", () => {
  const unlabelled: readonly RecordingRpcSegment[] = [
    { seq: 0, startMs: 0, endMs: 1_000, speakerLabel: null, text: "Hello" },
  ];
  const result = RecordingPanelView(panelProps(zh, attribution({ labels: [] }), unlabelled));
  expect(elements(result).some(element => element.type === "details")).toBe(false);
  expect(elementText(result)).not.toContain(zh["panel.attribution"]);
  expect(speakerInputs(result)).toHaveLength(0);
});

it("shows the typed name in the preview meta line without changing the label", () => {
  const update = vi.fn();
  const editable = RecordingPanelView(panelProps(zh, attribution({ update })));
  (speakerInputs(editable)[0]!.props.onChange as (event: { target: { value: string } }) => void)(
    { target: { value: "Erwin" } });
  expect(update).toHaveBeenCalledWith("Speaker A", "Erwin");

  const renamed = RecordingPanelView(panelProps(zh, attribution({ names: { "Speaker A": "Erwin" } })));
  const meta = elements(renamed)
    .filter(element => element.type === "span" && inlineText(element.props.children).startsWith("12:44"));
  expect(meta.map(element => inlineText(element.props.children))).toContain("12:44 · Erwin");
  expect(elementText(renamed)).not.toContain("12:44 · Speaker A");
});

it.each([zh, en])("warns when two speakers resolve to the same name", (locale: Locale) => {
  const duplicated = RecordingPanelView(panelProps(locale, attribution({
    names: { "Speaker A": "Erwin", "Speaker B": "Erwin" },
  })));
  expect(elementText(duplicated)).toContain(
    localized(locale, "panel.attributionDuplicate", { names: "Erwin" }));

  const distinct = RecordingPanelView(panelProps(locale, attribution({
    names: { "Speaker A": "Erwin", "Speaker B": "Bea" },
  })));
  expect(elementText(distinct)).not.toContain(locale["panel.attributionDuplicate"].split("{names}")[0]);
});

it("surfaces a failed save and a failed load under the section", () => {
  const saveFailed = RecordingPanelView(panelProps(en, attribution({
    failure: { action: "save", code: "EXPORT_SPEAKER_DUPLICATE" },
  })));
  expect(elementText(saveFailed)).toContain(en["panel.attributionSaveFailed"]);

  const loadFailed = RecordingPanelView(panelProps(en, attribution({
    failure: { action: "load", code: "UNKNOWN_ENDPOINT" },
  })));
  expect(elementText(loadFailed)).toContain(en["panel.attributionLoadFailed"]);
});
