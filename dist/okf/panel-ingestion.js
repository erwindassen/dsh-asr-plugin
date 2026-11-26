/**
 * Attempts that were started but have not reached the database yet. A job is
 * queued synchronously but `beginAttempt` happens inside the job, so between
 * the two the service has no row to report.
 */
export function panelIngestion(service) {
    const pending = new Set();
    function idle() {
        return { job_id: null, state: "idle", transcript_version: null, error_code: null, message: null };
    }
    return {
        async start(meetingId, options) {
            let outcome;
            try {
                outcome = service.start({ meetingId, force: options.force });
            }
            catch (error) {
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
        status(meetingId) {
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
                    // The stored message already names the failing step (and folds the
                    // bundle path), so the panel can show it instead of a dead end.
                    message: record.state === "failed" ? record.errorMessage ?? "Ingestion failed" : null,
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
function errorCode(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return null;
    const code = error.code;
    return typeof code === "string" ? code : null;
}
/** Short, path-free text for the panel; never the underlying cause. */
function ingestionMessage(error) {
    switch (errorCode(error)) {
        case "OKF_NOT_CONFIGURED":
            return "Choose an Open knowledge base folder in settings first.";
        case "OKF_NO_TRANSCRIPT":
            return "This meeting has no committed transcript yet.";
        case "OKF_BUSY":
            return "Another ingestion is already running.";
        case "OKF_NO_MODEL":
            return "Choose a model in DSH settings first.";
        case "OKF_NOT_VERSIONED":
            return "The folder could not be turned into a Git repository.";
        default:
            return "The ingestion could not start.";
    }
}
//# sourceMappingURL=panel-ingestion.js.map