import { randomUUID } from "node:crypto";
import { createOkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
import { createSpeakerNameRepository } from "../storage/speaker-name-repository.js";
import { openMeetingDatabase } from "../storage/database.js";
import { createAsrIngestCommand, } from "../okf/asr-ingest-command.js";
import { createOkfBundleLock } from "../okf/bundle-lock.js";
import { OkfError } from "../okf/contracts.js";
import { createOkfGitPort } from "../okf/git-port.js";
import { createOkfGitTransaction } from "../okf/git-transaction.js";
import { createOkfIngestionAgent, } from "../okf/ingestion-agent.js";
import { userTextMessage } from "../okf/user-message.js";
import { createOkfIngestionService, } from "../okf/ingestion-service.js";
import { startOkfIngestion, withTranscriptCommitHook } from "../okf/trigger.js";
/**
 * `AgentHandle` from the registry wraps the driver; the ingestion agent expects
 * the flattened shape, so this adapter owns the one place that difference lives.
 */
function agentFactory(context) {
    return {
        async create(options) {
            const handle = await context.agents.create(options);
            return {
                followup: (text) => handle.agent.followup(userTextMessage(text)),
                whenIdle: () => handle.agent.whenIdle(),
                interrupt: () => handle.agent.cancel({ kind: "parent" }),
                dispose: async () => { await handle.dispose(); },
            };
        },
    };
}
/**
 * Answers "is the okf skill visible here". No plain skill service is installed, so
 * the probe only answers negatively when a reachable service says so; otherwise it
 * stays optimistic, and a genuinely missing skill fails the child, rolls the whole
 * ingestion back and invents nothing.
 */
function skillProbe(context) {
    const service = context.get("skills");
    const has = service?.has;
    if (typeof has !== "function")
        return () => true;
    return (name) => {
        try {
            return has.call(service, name);
        }
        catch {
            return true;
        }
    };
}
function registerCommand(context, definition) {
    const runtime = context.get("commands");
    if (runtime === undefined || typeof runtime.register !== "function")
        return false;
    try {
        const disposer = runtime.register(definition);
        context.effect(() => () => {
            if (typeof disposer === "function")
                disposer();
        }, "dsh-asr: /asr-ingest command");
        return true;
    }
    catch (error) {
        context.logger("dsh-asr").warn(`/asr-ingest could not be registered: ${error instanceof Error ? error.name : "unknown"}`);
        return false;
    }
}
/** Wires the ingestion slices into the running host; call once from `apply`. */
export function installOkfHost(context, options) {
    const database = openMeetingDatabase(options.databasePath);
    const attempts = createOkfIngestionRepository(database);
    const speakerNames = createSpeakerNameRepository(database);
    const service = createOkfIngestionService({
        repository: options.repository,
        attempts,
        speakerNames,
        git: createOkfGitTransaction(createOkfGitPort(context)),
        lock: createOkfBundleLock(),
        agent: createOkfIngestionAgent({
            agents: agentFactory(context),
            skillAvailable: skillProbe(context),
            sessionId: () => `okf-ingest-${randomUUID()}`,
        }),
        settings: options.settings,
        jobs: context.jobs,
        logger: (line) => { context.logger("dsh-asr").info(line); },
    });
    const repository = withTranscriptCommitHook(options.repository, {
        onCommitted: (meetingId) => {
            const record = options.repository.getMeeting(meetingId);
            startOkfIngestion(service, {
                settings: options.settings,
                ...(record?.committedStatus === null || record?.committedStatus === undefined
                    ? {}
                    : { committedStatus: record.committedStatus }),
            }, meetingId);
        },
    });
    const definition = createAsrIngestCommand({
        directory: () => options.settings().directory,
        // No session-scoped reference is available to a plugin command yet.
        referencedMeetingId: () => null,
        meeting: options.meeting,
        ingest: async (meetingId, ingestOptions) => {
            const outcome = service.start({ meetingId, force: ingestOptions.force });
            if (outcome.jobId !== null)
                return { jobId: String(outcome.jobId) };
            if (outcome.kind === "disabled") {
                throw new OkfError("OKF_NOT_CONFIGURED", ingestOptions.force
                    ? "Choose an Open knowledge base folder in settings first"
                    : "Automatic ingestion is switched off; pass --force to ingest anyway");
            }
            throw new OkfError("OKF_AGENT_FAILED", "Open knowledge base ingestion could not start");
        },
    });
    const hasCommand = registerCommand(context, definition);
    void service.recoverStartup().catch((error) => {
        context.logger("dsh-asr").warn(`okf startup recovery failed: ${error instanceof OkfError ? error.code : "unknown"}`);
    });
    return {
        repository,
        service,
        speakerNames,
        hasCommand,
        async dispose() {
            // Abort in-flight ingestions first: closing the connection underneath a
            // running attempt would strand its row in `running` forever.
            await service.shutdown().catch(() => undefined);
            database.close();
        },
    };
}
//# sourceMappingURL=okf-host.js.map