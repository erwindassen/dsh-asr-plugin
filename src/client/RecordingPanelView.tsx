import { useEffect, useRef, useState } from "react";
import { recordingErrorCopy } from "./recording-error-copy.js";
import { Button, Tooltip, StateDot, IconWarningOutlineRegular, IconRefreshOutlineRegular } from "@deepseek-ai/dsh-client-ui-primitives";
import type { StateDotState } from "@deepseek-ai/dsh-client-ui-primitives";
import type { AudioDeviceInventoryRpc, RecordingRpcControlPayload, RecordingRpcSegment, RecordingRpcView } from "../recording/rpc-contract.js";
import { durationClock } from "./meeting-reference-source.js";
import {
  duplicateSpeakerNames,
  speakerNameFor,
  SPEAKER_NAME_MAX_LENGTH,
} from "../transcripts/speaker-attribution.js";
import type { RecordingPendingAction, SpeakerAttribution, Translate } from "./RecordingPanel.js";
import type { IngestionFailure, MeetingIngestion, StoredMeetings, SyncFailure } from "./use-stored-meetings.js";
import { RecordingControls, RecordingIcon } from "./RecordingPanelControls.js";
import { isRecordingActive } from "./recording-view-state.js";
import type { ConfigForm } from "@deepseek-ai/dsh-client-ui-settings/client";
import { RecognizerSelect } from "./RecognizerSelect.js";
import { useRecordingPanelLayout } from "./use-recording-panel-layout.js";
import styles from "./RecordingPanel.module.css";

/** A committed transcript is displayed instead of the live draft. */
export interface StoredPreview {
  /** Committed transcript version, or null while it is still loading. */
  readonly version: number | null;
  /** The committed transcript could not be read. */
  readonly failed?: boolean;
}

export interface PanelViewProps {
  readonly attribution?: SpeakerAttribution | undefined;
  readonly exportNotice?: string | null;
  readonly exportTranscript?: (choose: boolean) => Promise<void>;
  readonly prepare?: (signal: AbortSignal) => Promise<void>;
  readonly hasRecordingHistory: boolean;
  readonly failure: string | null;
  readonly canIngest?: boolean;
  readonly ingestion?: MeetingIngestion | undefined;
  readonly stored?: StoredPreview | null | undefined;
  readonly storedMeetings?: StoredMeetings | undefined;
  readonly join: () => Promise<void>;
  readonly pending: boolean;
  readonly pendingAction: RecordingPendingAction;
  readonly preview: readonly RecordingRpcSegment[];
  readonly devices: AudioDeviceInventoryRpc | null;
  readonly refreshDevices: () => Promise<void>;
  readonly run: (payload: RecordingRpcControlPayload) => Promise<void>;
  readonly selectDevice: (track: "mic" | "system", uid: string) => Promise<void>;
  readonly selectedDevices: { readonly mic: string; readonly system: string };
  readonly settings?: ConfigForm<Record<string, unknown>> | undefined;
  readonly settingsRevision?: number | undefined;
  readonly translate: Translate;
  readonly view: RecordingRpcView | null;
}

export { isRecordingActive } from "./recording-view-state.js";

/**
 * Ingestion is user-driven: it becomes available only for a committed
 * transcript that is currently displayed and only while no recording owns the
 * draft area.
 */
export function canIngest(props: Pick<PanelViewProps, "ingestion" | "pending" | "storedMeetings" | "view">): boolean {
  const stored = props.storedMeetings;
  if (stored === undefined || props.ingestion === undefined || props.ingestion.running) return false;
  if (isRecordingActive(props.view) || props.pending) return false;
  // A meeting displayed from the list needs its transcript loaded first.
  if (stored.selected !== null) {
    return stored.transcript !== null && !stored.transcriptLoading && stored.transcriptError === null;
  }
  // Otherwise the panel's own meeting can be ingested once it is committed.
  return props.view?.transcriptVersion !== null && props.view?.transcriptVersion !== undefined;
}

function phaseState(view: RecordingRpcView | null): StateDotState {
  if (waitingForSound(view)) return "warning";
  if (isRecordingActive(view)) return "ongoing";
  if (view?.phase === "failed") return "error";
  if (view?.phase === "partial") return "warning";
  return view?.phase === "completed" ? "done" : "idle";
}

function waitingForSound(view: RecordingRpcView | null): boolean {
  return view?.phase === "recording" && (view.mic.requested || view.system.requested) &&
    ![view.mic, view.system].some(track => track.state === "on" && track.errorCode === null);
}

function freshness(view: RecordingRpcView | null, translate: Translate): string {
  if (view?.latestDraftAtMs === null || view?.latestDraftAtMs === undefined) return translate("panel.draftWaiting");
  return translate("panel.draftFresh", {
    seconds: String(Math.max(0, Math.round((Date.now() - view.latestDraftAtMs) / 1_000))),
  });
}

function RecordingStatus({ pendingAction, translate, view }: Pick<PanelViewProps, "pendingAction" | "translate" | "view">) {
  const time = view?.durationMs ?? view?.recordingElapsedMs;
  const phase = pendingAction === "start" ? "starting" : pendingAction === "stop" ? "finalizing" : view?.phase;
  const stopping = phase === "finalizing" && view?.recordingEndedAtMs == null;
  return <>
    <div className={styles.status} aria-live="polite">
      <span className={styles.phase}>
        {view?.phase === "completed" ? <RecordingIcon name="check" /> : <StateDot size={6} state={phaseState(view)} />}
        {phase === undefined ? translate("panel.phase.none") :
          stopping ? translate("panel.stopping") : phase === "recording" && waitingForSound(view) ? translate("panel.waitingForSound") : translate(`phase.${phase}`)}
      </span>
      {time !== null && time !== undefined && <span className={styles.hint}>{durationClock(time)}</span>}
    </div>
    {view !== null && <div className={styles.tracks}>
      {(["mic", "system"] as const).map(track => <span key={track}
        className={`${styles.chip} ${view[track].errorCode !== null ? styles.warning : ""}`}>
        {translate(track === "mic" ? "panel.mic" : "panel.system")} {translate(
          view[track].errorCode === "SYSTEM_AUDIO_NO_SIGNAL" ? "panel.track.noSignal" : `panel.track.${view[track].state}`)}
      </span>)}
    </div>}
  </>;
}

function Preview({ attribution, preview, stored, translate, view }: Pick<PanelViewProps,
  "attribution" | "preview" | "stored" | "translate" | "view">) {
  const names = attribution?.names ?? {};
  const storedPreview = stored ?? null;
  const title = translate(storedPreview === null ? "panel.previewAria" : "panel.storedTitle");
  const storedHint = storedPreview?.failed === true ? "panel.storedLoadFailed" as const
    : storedPreview?.version === null || storedPreview?.version === undefined
      ? "panel.storedLoading" as const : "panel.storedEmptyTranscript" as const;
  const empty = preview.length === 0 ? (storedPreview === null
    ? translate(view === null ? "panel.readyHint" : "panel.draftWaiting") : translate(storedHint)) : null;
  const chip = storedPreview === null ? translate("panel.previewSpeaker")
    : storedPreview.failed === true ? translate("panel.storedLoadFailed")
      : storedPreview.version === null ? translate("panel.storedLoading")
        : translate("panel.storedVersion", { version: String(storedPreview.version) });
  return <div className={styles.preview} aria-label={title}>
    <div className={styles.previewHeading}>
      <span className={styles.previewTitle}>{title}</span>
      <span className={styles.chip}>{chip}</span>
    </div>
    <div className={styles.segments}>
      {empty !== null && <span className={styles.hint}>{empty}</span>}
      {preview.map(segment => <div className={styles.segment} key={segment.seq}>
        <span className={styles.segmentMeta}>{durationClock(segment.startMs)}
          {segment.speakerLabel !== null && ` · ${speakerNameFor(segment.speakerLabel, names)}`}</span>
        <span className={styles.text}>{segment.text}</span>
      </div>)}
    </div>
  </div>;
}

function storedDate(entry: { readonly started_at: string | null }): string {
  if (entry.started_at === null) return "";
  const date = new Date(entry.started_at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function ingestionFailureKey(failure: IngestionFailure): "panel.ingestNotConfigured" | "panel.ingestBusy"
  | "panel.ingestTimeout" | "panel.ingestNoModel" | "panel.ingestNoTranscript" | "panel.ingestFailed" {
  if (failure === "notConfigured") return "panel.ingestNotConfigured";
  if (failure === "busy") return "panel.ingestBusy";
  if (failure === "timeout") return "panel.ingestTimeout";
  if (failure === "noModel") return "panel.ingestNoModel";
  if (failure === "noTranscript") return "panel.ingestNoTranscript";
  return "panel.ingestFailed";
}

/** Maps a sync refusal to the sentence the panel shows under the heading. */
function syncFailureKey(failure: SyncFailure):
  "panel.syncNotConfigured" | "panel.syncMissingFolder" | "panel.syncFailed" {
  if (failure === "notConfigured") return "panel.syncNotConfigured";
  if (failure === "missingFolder") return "panel.syncMissingFolder";
  return "panel.syncFailed";
}


/** Committed meetings the panel can preview and ingest into the knowledge base. */
function StoredMeetingsSection({ ingestion, storedMeetings, translate }: Pick<PanelViewProps,
  "ingestion" | "storedMeetings" | "translate">) {
  if (storedMeetings === undefined) return null;
  const { disabled, entries, error, loading, select, selected, transcriptError, transcriptLoading, sync } = storedMeetings;
  const busy = ingestion?.running ?? false;
  const failure = ingestion?.outcome === "failed" ? ingestion.failure : null;
  const emptyHint = error === null ? translate("panel.storedEmpty") : translate("panel.storedLoadFailed");
  return <section className={styles.stored} aria-label={translate("panel.storedMeetings")}>
    <div className={styles.storedHeading}>
      <span className={styles.previewTitle}>{translate("panel.storedMeetings")}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <Button variant="ghost" className={styles.syncButton} aria-busy={sync.busy}
        disabled={sync.busy} onClick={sync.request}>
        {translate("panel.sync")}
      </Button>
    </div>
    {sync.pending !== null && sync.pending > 0 && <div className={styles.syncRow} role="status">
      <span className={styles.hint}>{translate("panel.syncConfirm", { count: String(sync.pending) })}</span>
      <Button variant="ghost" onClick={sync.confirm}>{translate("panel.syncRemove")}</Button>
      <Button variant="ghost" onClick={sync.cancel}>{translate("panel.syncCancel")}</Button>
    </div>}
    {sync.pending === 0 && <p className={styles.hint} role="status">{translate("panel.syncNothing")}</p>}
    {sync.removed !== null && <p className={styles.hint} role="status">
      {translate("panel.syncDone", { count: String(sync.removed) })}
    </p>}
    {sync.failure !== null && <p className={styles.storedError} role="alert">
      {translate(syncFailureKey(sync.failure))}
    </p>}
    <p className={styles.hint}>{translate("panel.storedHint")}</p>
    {entries.length === 0 && !loading && <p className={styles.hint}>{emptyHint}</p>}
    {entries.length > 0 && <div className={styles.storedList} role="listbox" aria-label={translate("panel.storedMeetings")}>
      {entries.map(entry => {
        const ingested = entry.ingested_transcript_version !== null
          && entry.ingested_transcript_version >= entry.transcript_version;
        const date = storedDate(entry);
        return <button key={entry.meeting_id} type="button" role="option"
          aria-selected={selected?.meeting_id === entry.meeting_id}
          className={styles.storedRow} disabled={disabled || busy}
          onClick={() => select(entry)}>
          <span className={styles.storedTitle}>
            {entry.title === "" ? translate("panel.storedUntitled") : entry.title}
          </span>
          {date !== "" && <span className={styles.storedMeta}>{date}</span>}
          {ingested && <span className={styles.chip}>{translate("panel.storedIngested")}</span>}
        </button>;
      })}
    </div>}
    {transcriptLoading && <p className={styles.hint} role="status">{translate("panel.storedLoading")}</p>}
    {transcriptError !== null && <p className={styles.storedError} role="alert">{translate("panel.storedLoadFailed")}</p>}
    {ingestion?.outcome === "succeeded" && <p className={styles.hint} role="status">{translate("panel.ingested")}</p>}
    {failure !== null && <p className={styles.storedError} role="alert">{translate(ingestionFailureKey(failure))}</p>}
    {ingestion?.detail != null && ingestion.detail !== "" && (
      <p className={styles.storedErrorDetail} role="status">{ingestion.detail}</p>
    )}
  </section>;
}

/**
 * Optional renaming of the detected speaker labels for the exported file. The
 * stored transcript keeps its labels; only the export applies the names.
 */
function SpeakerAttributionSection({ attribution, translate }: Pick<PanelViewProps, "attribution" | "translate">) {
  if (attribution === undefined || attribution.labels.length === 0) return null;
  const { failure, labels, names, saving, update } = attribution;
  const duplicates = duplicateSpeakerNames(labels, names);
  return <>
    <details className={styles.attribution}>
      <summary className={styles.attributionSummary}>{translate("panel.attribution")}</summary>
      <p className={styles.hint}>{translate("panel.attributionHint")}</p>
      <div className={styles.attributionFields}>
        {labels.map(label => <label className={styles.attributionField} key={label}>
          <span className={styles.attributionLabel}>{label}</span>
          <input className={styles.attributionInput} type="text" value={names[label] ?? ""}
            aria-label={label} placeholder={label} maxLength={SPEAKER_NAME_MAX_LENGTH} spellCheck={false}
            onChange={event => update(label, event.target.value)} />
        </label>)}
      </div>
      {duplicates.length > 0 && <p className={`${styles.hint} ${styles.warning}`} role="status">
        {translate("panel.attributionDuplicate", { names: duplicates.join(" · ") })}
      </p>}
      {saving && <p className={styles.hint} role="status">{translate("panel.attributionSaving")}</p>}
    </details>
    {failure !== null && <p className={styles.attributionError} role="alert">
      {translate(failure.action === "load" ? "panel.attributionLoadFailed" : "panel.attributionSaveFailed")}
    </p>}
  </>;
}

function FooterStatus({ translate, view }: Pick<PanelViewProps, "translate" | "view">) {
  const text = isRecordingActive(view) ? view?.draftStale ? translate("panel.draftStale") : freshness(view, translate)
    : view?.finalizationMs === null || view?.finalizationMs === undefined ? translate("panel.previewHint")
      : translate("panel.finalization", { seconds: String(Math.round(view.finalizationMs / 100) / 10) });
  return <span className={`${styles.hint} ${view?.draftStale ? styles.warning : ""}`}>{text}</span>;
}

export function RecordingPanelView(props: PanelViewProps) {
  const { translate } = props;
  const codes = [...new Set([props.failure, props.view?.mic.errorCode, props.view?.system.errorCode]
    .filter((code): code is string => code != null))];
  const noSignal = codes.length === 1 && codes[0] === "SYSTEM_AUDIO_NO_SIGNAL";
  const failure = codes.length === 0 ? null : [...new Set(codes.map(code => recordingErrorCopy(code, translate)))].join("\n");
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  // The header controls keep their natural size, so their total width is the narrowest
  // window the panel can open at without squeezing the buttons.
  const compactWidth = Math.max(260, headerWidth);
  const layout = useRecordingPanelLayout(compactWidth, Math.max(300, compactWidth));
  useEffect(() => {
    if (!layout.expanded || props.prepare === undefined) return;
    const controller = new AbortController();
    void props.prepare(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [layout.expanded, props.prepare]);
  useEffect(() => {
    const header = headerRef.current;
    if (header === null) return undefined;
    const measure = () => {
      const children = Array.from(header.children) as HTMLElement[];
      const gap = 4;
      const padding = 10;
      setHeaderWidth(Math.ceil(children.reduce((total, child) => total + child.offsetWidth, 0)
        + Math.max(0, children.length - 1) * gap + padding));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [failure, layout.expanded]);
  const toggleLabel = translate(layout.expanded ? "panel.collapse" : "panel.expand");
  return <section className={styles.panel} data-expanded={layout.expanded} style={layout.style} aria-label={translate("panel.aria")}>
    <header className={styles.header} ref={headerRef}>
      <Button className={styles.move} aria-label={translate("panel.move")} {...layout.move}><RecordingIcon name="grip" /></Button>
      <RecordingControls {...props} canIngest={canIngest(props)} />
      <span className={styles.spacer} />
      <RecognizerSelect revision={props.settingsRevision} settings={props.settings} translate={translate} />
      {failure !== null && <Tooltip label={failure}>
        <Button size="sm" className={`${styles.errorControl} ${noSignal ? styles.noSignal : ""}`} aria-label={failure}
          icon={<IconWarningOutlineRegular />} onClick={() => !layout.expanded && layout.toggle()} />
      </Tooltip>}
      <Button className={styles.toggle} aria-label={toggleLabel} aria-expanded={layout.expanded}
        onClick={layout.toggle}><RecordingIcon name={layout.expanded ? "collapse" : "expand"} /></Button>
    </header>
    {layout.expanded && <>
      <div className={styles.body}>
        <RecordingStatus {...props} />
        {failure !== null && <div className={`${styles.error} ${noSignal ? styles.noSignal : ""}`} role="alert">{failure}</div>}
        {codes.some(code => /^[A-Z][A-Z0-9_]{0,99}$/.test(code)) && <details><summary>{translate("panel.error.details")}</summary>
          <code>{codes.filter(code => /^[A-Z][A-Z0-9_]{0,99}$/.test(code)).join(" · ")}</code></details>}
        <Preview {...props} />
        <SpeakerAttributionSection attribution={props.attribution} translate={translate} />
        <StoredMeetingsSection {...props} />
      </div>
      <footer className={styles.footer}>
        {props.exportNotice != null && <span className={styles.hint}>{props.exportNotice}</span>}
        <FooterStatus {...props} />
        <Tooltip label={translate("panel.exportHint")}>
          <Button size="sm" className={styles.utility} aria-label={props.pendingAction === "export"
            ? translate("panel.exporting") : translate("panel.export")} icon={<RecordingIcon name="export" />}
            aria-busy={props.pendingAction === "export"} disabled={props.exportTranscript === undefined
            || props.pending || props.view?.transcriptVersion == null}
            onClick={event => void props.exportTranscript?.(event.altKey)} />
        </Tooltip>
        <Tooltip label={translate("panel.reset")}>
          <Button size="sm" className={styles.utility} aria-label={translate("panel.reset")} icon={<IconRefreshOutlineRegular />} onClick={layout.reset} />
        </Tooltip>
        <Button className={styles.resize} aria-label={translate("panel.resize")} {...layout.resize}><RecordingIcon name="resize" /></Button>
      </footer>
    </>}
  </section>;
}
