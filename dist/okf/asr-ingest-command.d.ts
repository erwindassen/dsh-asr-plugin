/** Slash command that ingests one committed meeting into the OKF bundle. */
export declare const ASR_INGEST_COMMAND_NAME = "asr-ingest";
/** Returned when the bundle folder is not configured yet. */
export declare const OKF_DIRECTORY_REQUIRED_MESSAGE = "Choose an Open knowledge base folder in settings first";
export interface AsrIngestMeeting {
    readonly meetingId: string;
    readonly title: string;
}
export interface AsrIngestJob {
    readonly jobId: string;
}
export interface AsrIngestCommandDeps {
    /** Configured bundle folder; empty means the feature is not set up. */
    readonly directory: () => string;
    /** Meeting the command was invoked from, if the runtime supplies one. */
    readonly referencedMeetingId: () => string | null;
    readonly meeting: (meetingId: string) => AsrIngestMeeting | null;
    readonly ingest: (meetingId: string, options: {
        readonly force: boolean;
    }) => Promise<AsrIngestJob>;
}
export type AsrIngestCommandResult = {
    readonly kind: "success";
    readonly text: string;
} | {
    readonly kind: "error";
    readonly text: string;
};
/**
 * Structural copy of the host command runtime shape. `@deepseek-ai/dsh-commands`
 * is not part of this package's installed toolchain, so the host registers this
 * object through `context.get("commands")` and only these fields are relied on.
 */
export interface OkfCommandDefinition {
    readonly name: typeof ASR_INGEST_COMMAND_NAME;
    readonly description: string;
    readonly input?: {
        readonly hint: string;
    };
    readonly handler: (input: {
        readonly args: string;
    }) => Promise<AsrIngestCommandResult>;
}
export type ParsedAsrIngestArgs = {
    readonly kind: "ok";
    readonly meetingId: string | null;
    readonly force: boolean;
} | {
    readonly kind: "error";
    readonly message: string;
};
/**
 * Parse `<meeting-id> [--force]`. A bare `--force` leaves the meeting null so
 * the handler can fall back to the meeting the command was invoked from.
 */
export declare function parseAsrIngestArgs(args: string): ParsedAsrIngestArgs;
export declare function createAsrIngestCommand(deps: AsrIngestCommandDeps): OkfCommandDefinition;
