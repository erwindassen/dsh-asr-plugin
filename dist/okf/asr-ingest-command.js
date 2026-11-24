import { OkfError } from "./contracts.js";
/** Slash command that ingests one committed meeting into the OKF bundle. */
export const ASR_INGEST_COMMAND_NAME = "asr-ingest";
/** Returned when the bundle folder is not configured yet. */
export const OKF_DIRECTORY_REQUIRED_MESSAGE = "Choose an Open knowledge base folder in settings first";
/** Text after the command name, tolerating either invocation shape. */
export function commandInputArgs(invocation) {
    if (typeof invocation?.rawInput === "string")
        return invocation.rawInput;
    if (typeof invocation?.args === "string")
        return invocation.args;
    return "";
}
/**
 * Parse `<meeting-id> [--force]`. A bare `--force` leaves the meeting null so
 * the handler can fall back to the meeting the command was invoked from.
 */
export function parseAsrIngestArgs(args) {
    let meetingId = null;
    let force = false;
    const tokens = args.trim().split(/\s+/u).filter(token => token !== "");
    for (const token of tokens) {
        if (token === "--force") {
            if (force)
                return { kind: "error", message: "Pass --force only once." };
            force = true;
            continue;
        }
        if (token.startsWith("-"))
            return { kind: "error", message: `Unknown option ${token}.` };
        if (meetingId !== null)
            return { kind: "error", message: "Pass exactly one meeting id." };
        meetingId = token;
    }
    return { kind: "ok", meetingId, force };
}
function jobText(meeting, job) {
    const title = meeting.title.replace(/\s+/gu, " ").trim();
    const name = title === "" ? meeting.meetingId : `"${title}" (${meeting.meetingId})`;
    return `Ingestion of ${name} started as job ${job.jobId}.`;
}
function failureText(error) {
    if (!(error instanceof OkfError))
        return "Open knowledge base ingestion failed.";
    switch (error.code) {
        case "OKF_NOT_CONFIGURED":
            return OKF_DIRECTORY_REQUIRED_MESSAGE;
        case "OKF_BUSY":
            return "Another ingestion is already running. Try again when it finishes.";
        case "CANCELLED_BY_USER":
            return "Open knowledge base ingestion was cancelled.";
        case "OKF_AGENT_FAILED":
            return "The Open knowledge base writer failed.";
        case "OKF_GIT_FAILED":
            return "The Open knowledge base commit failed.";
        default:
            return `Open knowledge base ingestion failed (${error.code}).`;
    }
}
export function createAsrIngestCommand(deps) {
    return {
        name: ASR_INGEST_COMMAND_NAME,
        description: "Ingest a committed meeting transcript into the Open knowledge base",
        input: { hint: "<meeting-id> [--force]" },
        async handler(invocation) {
            const parsed = parseAsrIngestArgs(commandInputArgs(invocation));
            if (parsed.kind === "error")
                return { kind: "error", text: parsed.message };
            let directory;
            try {
                directory = deps.directory();
            }
            catch {
                return { kind: "error", text: OKF_DIRECTORY_REQUIRED_MESSAGE };
            }
            if (directory.trim() === "")
                return { kind: "error", text: OKF_DIRECTORY_REQUIRED_MESSAGE };
            let referenced;
            try {
                referenced = deps.referencedMeetingId();
            }
            catch {
                referenced = null;
            }
            const meetingId = parsed.meetingId ?? referenced;
            if (meetingId === null || meetingId.trim() === "") {
                return { kind: "error", text: "Pass a meeting id: /asr-ingest <meeting-id> [--force]." };
            }
            let meeting;
            try {
                meeting = deps.meeting(meetingId);
            }
            catch {
                return { kind: "error", text: `Meeting ${meetingId} was not found.` };
            }
            if (meeting === null)
                return { kind: "error", text: `Meeting ${meetingId} was not found.` };
            try {
                const job = await deps.ingest(meeting.meetingId, { force: parsed.force });
                return { kind: "success", text: jobText(meeting, job) };
            }
            catch (error) {
                return { kind: "error", text: failureText(error) };
            }
        },
    };
}
//# sourceMappingURL=asr-ingest-command.js.map