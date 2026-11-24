/**
 * Both import and retranscription funnel through `commitTranscript`, so one
 * interception covers every committed version while drafts, cancelled
 * recordings and failed runs never reach the hook at all.
 */
export function withTranscriptCommitHook(repository, hook) {
    return new Proxy(repository, {
        get(target, property, receiver) {
            if (property === "commitTranscript") {
                return (input) => {
                    const result = target.commitTranscript(input);
                    try {
                        if (result.outcome === "committed") {
                            hook.onCommitted(result.meeting.meetingId, result.meeting.transcriptVersion);
                        }
                    }
                    catch {
                        // A failed hand-off must never fail the transcript commit itself.
                    }
                    return result;
                };
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}
/** Starts ingestion for a committed version when the settings allow it. */
export function startOkfIngestion(service, options, meetingId) {
    if (options.committedStatus === "empty")
        return;
    const current = options.settings();
    if (current.directory.trim() === "" || current.ingest !== true)
        return;
    service.start({ meetingId, skipIfSucceeded: true });
}
//# sourceMappingURL=trigger.js.map