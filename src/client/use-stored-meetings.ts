import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type {
  OkfIngestRpcValue,
  StoredMeetingRpcEntry,
  StoredMeetingTranscriptRpcValue,
} from "../recording/rpc-contract.js";
import type { RecordingRpcClient } from "./recording-rpc-client.js";

/** Poll cadence while the host works on an ingestion. */
export const INGEST_POLL_MS = 2_000;
/** Five minutes: long enough for the agent, short enough to stop a stuck spinner. */
export const INGEST_POLL_ATTEMPTS = 150;

export type IngestionFailure = "notConfigured" | "busy" | "unavailable" | "timeout";

export interface MeetingIngestion {
  readonly running: boolean;
  readonly outcome: "succeeded" | "failed" | null;
  readonly failure: IngestionFailure | null;
  readonly start: () => void;
}

export interface StoredMeetings {
  readonly entries: readonly StoredMeetingRpcEntry[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly selected: StoredMeetingRpcEntry | null;
  readonly transcript: StoredMeetingTranscriptRpcValue | null;
  readonly transcriptLoading: boolean;
  readonly transcriptError: string | null;
  /** A live recording owns the draft area; stored rows stay inactive meanwhile. */
  readonly disabled: boolean;
  readonly select: (entry: StoredMeetingRpcEntry) => void;
  readonly clear: () => void;
  readonly reload: () => void;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function errorCode(cause: unknown): string | null {
  if (cause instanceof Error) return cause.message;
  return typeof cause === "string" ? cause : null;
}

/**
 * Only the categories the panel can explain are kept; the raw message may name
 * a folder, a transcript or an internal failure and must never reach the UI.
 * A failed RPC wraps the host code inside its message, so match on containment.
 */
export function ingestionFailure(code: string | null): IngestionFailure {
  if (code === null) return "unavailable";
  if (code.includes("OKF_NOT_CONFIGURED")) return "notConfigured";
  if (code.includes("OKF_BUSY")) return "busy";
  return "unavailable";
}

export interface MeetingIngestionOptions {
  readonly client: RecordingRpcClient;
  readonly meetingId: string | null;
  readonly mounted: RefObject<boolean>;
  readonly onIngested?: ((meetingId: string) => void) | undefined;
}

/**
 * Starts one user-driven ingestion and polls its attempt until it settles.
 * The poll is bounded; a timeout shows the same short retry message as a
 * failure instead of leaving the button spinning forever.
 */
export function useMeetingIngestion(options: MeetingIngestionOptions): MeetingIngestion {
  const { client, meetingId, mounted, onIngested } = options;
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<"succeeded" | "failed" | null>(null);
  const [failure, setFailure] = useState<IngestionFailure | null>(null);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  // A new selection (or a recording taking over) cancels the previous attempt
  // so its result cannot be reported against another meeting.
  useEffect(() => {
    setOutcome(null);
    setFailure(null);
    return () => {
      generation.current += 1;
      active.current?.abort();
      setRunning(false);
    };
  }, [meetingId]);

  const start = useCallback(() => {
    if (meetingId === null) return;
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    const request = ++generation.current;
    setRunning(true);
    setOutcome(null);
    setFailure(null);
    void (async () => {
      let status: OkfIngestRpcValue;
      try {
        status = await client.ingestMeeting({ meeting_id: meetingId }, controller.signal);
        for (let attempt = 0;
          status.state !== "succeeded" && status.state !== "failed" && attempt < INGEST_POLL_ATTEMPTS;
          attempt += 1) {
          await pause(INGEST_POLL_MS, controller.signal);
          if (controller.signal.aborted || !mounted.current) return;
          status = await client.ingestionStatus({ meeting_id: meetingId }, controller.signal);
        }
      } catch (cause) {
        if (controller.signal.aborted || !mounted.current || generation.current !== request) return;
        setRunning(false);
        setFailure(ingestionFailure(errorCode(cause)));
        setOutcome("failed");
        return;
      }
      if (controller.signal.aborted || !mounted.current || generation.current !== request) return;
      setRunning(false);
      if (status.state === "succeeded") {
        setOutcome("succeeded");
        onIngested?.(meetingId);
        return;
      }
      setFailure(status.state === "failed" ? ingestionFailure(status.error_code) : "timeout");
      setOutcome("failed");
    })();
  }, [client, meetingId, mounted, onIngested]);

  return { running, outcome, failure, start };
}

export interface StoredMeetingsOptions {
  readonly client: RecordingRpcClient;
  readonly mounted: RefObject<boolean>;
  readonly active: boolean;
}

/**
 * Lists committed meetings and loads one committed transcript on demand. A
 * live recording clears the selection so the draft area always follows it.
 */
export function useStoredMeetings(options: StoredMeetingsOptions): StoredMeetings {
  const { active, client, mounted } = options;
  const [entries, setEntries] = useState<readonly StoredMeetingRpcEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<StoredMeetingRpcEntry | null>(null);
  const [transcript, setTranscript] = useState<StoredMeetingTranscriptRpcValue | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [selectionAttempt, setSelectionAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void client.listMeetings(undefined, controller.signal).then(items => {
      if (!mounted.current || controller.signal.aborted) return;
      setEntries(items);
      setError(null);
      setLoading(false);
    }).catch(() => {
      if (!mounted.current || controller.signal.aborted) return;
      setError("LOAD_FAILED");
      setLoading(false);
    });
    return () => controller.abort();
  }, [client, mounted, reloadToken]);

  const wasActive = useRef(false);
  useEffect(() => {
    if (active) {
      setSelected(null);
      wasActive.current = true;
      return;
    }
    // A finished recording adds a meeting; list again so it can be picked.
    if (wasActive.current) {
      wasActive.current = false;
      setReloadToken(token => token + 1);
    }
  }, [active]);

  useEffect(() => {
    if (selected === null) {
      setTranscript(null);
      setTranscriptLoading(false);
      setTranscriptError(null);
      return undefined;
    }
    const controller = new AbortController();
    setTranscript(null);
    setTranscriptError(null);
    setTranscriptLoading(true);
    void client.meetingTranscript({ meeting_id: selected.meeting_id }, controller.signal).then(value => {
      if (!mounted.current || controller.signal.aborted) return;
      setTranscript(value);
      setTranscriptLoading(false);
    }).catch(() => {
      if (!mounted.current || controller.signal.aborted) return;
      setTranscriptError("LOAD_FAILED");
      setTranscriptLoading(false);
    });
    return () => controller.abort();
  }, [client, mounted, selected, selectionAttempt]);

  const select = useCallback((entry: StoredMeetingRpcEntry) => {
    setSelected(entry);
    setSelectionAttempt(attempt => attempt + 1);
  }, []);
  const clear = useCallback(() => setSelected(null), []);
  const reload = useCallback(() => setReloadToken(token => token + 1), []);

  return {
    entries, loading, error, selected, transcript, transcriptLoading, transcriptError,
    disabled: active, select, clear, reload,
  };
}
