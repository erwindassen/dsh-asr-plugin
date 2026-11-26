import type { OkfIngestRpcValue } from "../recording/rpc-contract.js";
import type { OkfIngestionService } from "./ingestion-service.js";

/**
 * Ingestion as the recording panel sees it. The panel starts one meeting and
 * then polls the same meeting, so the adapter only has to translate the
 * service's outcomes and attempt rows into one wire shape.
 */
export interface PanelIngestion {
  start(meetingId: string, options: { readonly force: boolean }): Promise<OkfIngestRpcValue>;
  status(meetingId: string): OkfIngestRpcValue;
}

/**
 * Attempts that were started but have not reached the database yet. A job is
 * queued synchronously but `beginAttempt` happens inside the job, so between
 * the two the service has no row to report.
 */
export function panelIngestion(service: OkfIngestionService): PanelIngestion {
  const pending = new Set<string>();

  function idle(): OkfIngestRpcValue {
    return { job_id: null, state: "idle", transcript_version: null, error_code: null, message: null };
  }

  return {
    async start(meetingId, options): Promise<OkfIngestRpcValue> {
      let outcome;
      try {
        outcome = service.start({ meetingId, force: options.force });
      } catch (error) {
        return {
          job_id: null,
          state: "failed",
          transcript_version: null,
          error_code: errorCode(error),
          message: ingestionMessage(error),
        };
      }
      if (outcome.jobId !== null) {
        pending.add(meetingId);
        return {
          job_id: outcome.jobId,
          state: "running",
          transcript_version: null,
          error_code: null,
          message: null,
        };
      }
      const record = service.state(meetingId);
      pending.delete(meetingId);
      return {
        job_id: null,
        state: outcome.kind === "failed" ? "failed" : "succeeded",
        transcript_version: record?.transcriptVersion ?? null,
        error_code: record?.errorCode ?? null,
        message: outcome.kind === "started" ? null : outcome.message,
      };
    },

    status(meetingId): OkfIngestRpcValue {
      const record = service.state(meetingId);
      if (record !== undefined && record.state === "running") {
        return {
          job_id: null,
          state: "running",
          transcript_version: record.transcriptVersion,
          error_code: null,
          message: null,
        };
      }
      if (record !== undefined) {
        pending.delete(meetingId);
        return {
          job_id: null,
          state: record.state === "failed" ? "failed" : "succeeded",
          transcript_version: record.transcriptVersion,
          error_code: record.errorCode ?? null,
          message: record.state === "failed" ? "Ingestion failed" : null,
        };
      }
      if (pending.has(meetingId)) {
        return { job_id: null, state: "running", transcript_version: null, error_code: null, message: null };
      }
      return idle();
    },
  };
}

/** A stable code the panel can explain; never the underlying message. */
function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Short, path-free text for the panel; never the underlying cause. */
function ingestionMessage(error: unknown): string {
  switch (errorCode(error)) {
    case "OKF_NOT_CONFIGURED":
      return "Choose an Open knowledge base folder in settings first.";
    case "OKF_NO_TRANSCRIPT":
      return "This meeting has no committed transcript yet.";
    case "OKF_BUSY":
      return "Another ingestion is already running.";
    default:
      return "The ingestion could not start.";
  }
}
