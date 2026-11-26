import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import type { CreateAgentOptions } from "@deepseek-ai/dsh-agent";

import { createOkfIngestionRepository, type OkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
import { createSpeakerNameRepository, type SpeakerNameRepository } from "../storage/speaker-name-repository.js";
import { openMeetingDatabase } from "../storage/database.js";
import type { MeetingRepository } from "../storage/meeting-repository.js";
import {
  createAsrIngestCommand,
  type AsrIngestJob,
  type OkfCommandDefinition,
} from "../okf/asr-ingest-command.js";
import { createOkfBundleLock } from "../okf/bundle-lock.js";
import { OkfError } from "../okf/contracts.js";
import { createOkfGitPort } from "../okf/git-port.js";
import { createOkfGitTransaction } from "../okf/git-transaction.js";
import {
  createOkfIngestionAgent,
  type OkfAgentFactory,
  type OkfAgentHandle,
  type OkfAgentSeed,
} from "../okf/ingestion-agent.js";
import { createPageWriteRegistry, type OkfPageWriteRegistry } from "../okf/write-session.js";
import { userTextMessage } from "../okf/user-message.js";
import {
  createOkfIngestionService,
  type OkfIngestionService,
  type OkfSettings,
} from "../okf/ingestion-service.js";

/** Command runtime as reached through `context.get("commands")`; the package is not installed. */
interface CommandRuntime {
  register(definition: OkfCommandDefinition): unknown;
}

export interface OkfHostOptions {
  readonly databasePath: string;
  /** Unwrapped repository; the host returns a hooked wrapper for the application. */
  readonly repository: MeetingRepository;
  readonly settings: () => OkfSettings;
  readonly meeting: (meetingId: string) => { readonly meetingId: string; readonly title: string } | null;
}

export interface OkfHost {
  /** Unwrapped repository; ingestion is user-driven, so commits start nothing. */
  readonly repository: MeetingRepository;
  readonly service: OkfIngestionService;
  /** Ingestion attempt log, shared with the recording panel's read model. */
  readonly attempts: OkfIngestionRepository;
  /** Per-meeting speaker attribution, shared with the recording panel RPC. */
  readonly speakerNames: SpeakerNameRepository;
  /** Write authority the summarising child uses through `okf_write_page`. */
  readonly pages: OkfPageWriteRegistry;
  hasCommand: boolean;
  dispose(): Promise<void>;
}

/**
 * `AgentHandle` from the registry wraps the driver; the ingestion agent expects
 * the flattened shape, so this adapter owns the one place that difference lives.
 */
/** Route a child agent needs; the plugin runs outside any agent turn. */
interface AgentRouteOptions {
  readonly agentOptions: NonNullable<CreateAgentOptions["agentOptions"]>;
  readonly agentPreset?: string;
}

/** Reads the default model selection DSH settings own, plus the composed preset. */
function agentRoute(context: Context): AgentRouteOptions {
  const defaults = context.get("agentDefaultModel") as
    | { currentSelection?: () => unknown }
    | undefined;
  let selection: unknown;
  try {
    selection = defaults?.currentSelection?.();
  } catch {
    selection = undefined;
  }
  const fields = (typeof selection === "object" && selection !== null ? selection : {}) as Record<string, unknown>;
  const route = (typeof fields.route === "object" && fields.route !== null ? fields.route : {}) as Record<string, unknown>;
  const provider = typeof fields.provider === "string" ? fields.provider : route.provider;
  const model = typeof fields.model === "string" ? fields.model : route.model;
  if (typeof provider !== "string" || provider === "" || typeof model !== "string" || model === "") {
    throw new OkfError(
      "OKF_NO_MODEL",
      "Choose a model in DSH settings before summarising a meeting",
    );
  }
  const reasoningEffort = fields.reasoningEffort ?? route.reasoningEffort;
  const agentOptions: NonNullable<CreateAgentOptions["agentOptions"]> = {
    provider,
    model,
    ...(typeof reasoningEffort === "string" ? { reasoningEffort } : {}),
  } as NonNullable<CreateAgentOptions["agentOptions"]>;

  const presets = context.get("agentPresets") as
    | { composedPreset?: (scope: Context) => string | undefined }
    | undefined;
  let agentPreset: string | undefined;
  try {
    agentPreset = presets?.composedPreset?.(context);
  } catch {
    agentPreset = undefined;
  }
  return agentPreset === undefined ? { agentOptions } : { agentOptions, agentPreset };
}

/** Exported for tests: the adapter owns the model route and the write session. */
export function okfAgentFactory(context: Context, pages: OkfPageWriteRegistry): OkfAgentFactory {
  // Cordis resolves a service proxy against the fiber that reads it, and the
  // plugin root never injected `agents`, so `context.agents` threw "cannot get
  // property \"agents\" without inject" the moment a summarising child was
  // created. Hold a context that declared the injection and create through it.
  let agentsContext: Context | undefined;
  context.inject(["agents"], (agentsCtx) => {
    agentsContext = agentsCtx;
    return () => {
      if (agentsContext === agentsCtx) agentsContext = undefined;
    };
  });
  return {
    async create(options: CreateAgentOptions, seed: OkfAgentSeed): Promise<OkfAgentHandle> {
      const route = agentRoute(context);
      const meta = route.agentPreset === undefined
        ? options.meta
        : { ...options.meta, agentPreset: route.agentPreset };
      const agents = agentsContext?.agents;
      if (agents === undefined) {
        throw new OkfError(
          "OKF_AGENT_FAILED",
          "The agent service is not available yet; reopen the application and try again",
        );
      }
      const handle = await agents.create({
        ...options,
        agentOptions: route.agentOptions,
        ...(meta === undefined ? {} : { meta }),
      });
      // The child's tool set has no filesystem tools, so the plugin lends it one
      // writer for this bundle only, for as long as the child lives.
      const sessionId = String(options.sessionId);
      pages.open(sessionId, { root: seed.directory, meetingId: seed.meetingId });
      return {
        followup: (text: string) => handle.agent.followup(userTextMessage(text)),
        whenIdle: () => handle.agent.whenIdle(),
        interrupt: () => handle.agent.cancel({ kind: "parent" }),
        dispose: async () => {
          pages.close(sessionId);
          await handle.dispose();
        },
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
function skillProbe(context: Context): (name: string) => boolean {
  const service = context.get("skills") as { has?: (name: string) => boolean } | undefined;
  const has = service?.has;
  if (typeof has !== "function") return () => true;
  return (name: string): boolean => {
    try {
      return has.call(service, name);
    } catch {
      return true;
    }
  };
}

function registerCommand(context: Context, definition: OkfCommandDefinition): boolean {
  const runtime = context.get("commands") as CommandRuntime | undefined;
  if (runtime === undefined || typeof runtime.register !== "function") return false;
  try {
    const disposer = runtime.register(definition);
    context.effect(
      () => () => {
        if (typeof disposer === "function") (disposer as () => void)();
      },
      "dsh-asr: /asr-ingest command",
    );
    return true;
  } catch (error) {
    context.logger("dsh-asr").warn(`/asr-ingest could not be registered: ${error instanceof Error ? error.name : "unknown"}`);
    return false;
  }
}

/** Wires the ingestion slices into the running host; call once from `apply`. */
export function installOkfHost(context: Context, options: OkfHostOptions): OkfHost {
  const database = openMeetingDatabase(options.databasePath);
  const attempts = createOkfIngestionRepository(database);
  const speakerNames = createSpeakerNameRepository(database);
  const pages = createPageWriteRegistry();
  const service = createOkfIngestionService({
    repository: options.repository,
    attempts,
    speakerNames,
    git: createOkfGitTransaction(createOkfGitPort(context)),
    lock: createOkfBundleLock(),
    agent: createOkfIngestionAgent({
      agents: okfAgentFactory(context, pages),
      skillAvailable: skillProbe(context),
      sessionId: () => `okf-ingest-${randomUUID()}`,
    }),
    settings: options.settings,
    jobs: context.jobs,
    logger: (line) => { context.logger("dsh-asr").info(line); },
  });
  // Ingestion is user-driven: the panel button and `/asr-ingest` are the only
  // entry points, so committing a transcript never starts work on its own.
  const repository = options.repository;
  const definition = createAsrIngestCommand({
    directory: () => options.settings().directory,
    // No session-scoped reference is available to a plugin command yet.
    referencedMeetingId: () => null,
    meeting: options.meeting,
    ingest: async (meetingId, ingestOptions): Promise<AsrIngestJob> => {
      const outcome = service.start({ meetingId, force: ingestOptions.force });
      if (outcome.jobId !== null) return { jobId: String(outcome.jobId) };
      if (outcome.kind === "disabled") {
        throw new OkfError(
          "OKF_NOT_CONFIGURED",
          ingestOptions.force
            ? "Choose an Open knowledge base folder in settings first"
            : "Automatic ingestion is switched off; pass --force to ingest anyway",
        );
      }
      throw new OkfError("OKF_AGENT_FAILED", "Open knowledge base ingestion could not start");
    },
  });
  const hasCommand = registerCommand(context, definition);
  void service.recoverStartup().catch((error: unknown) => {
    context.logger("dsh-asr").warn(
      `okf startup recovery failed: ${error instanceof OkfError ? error.code : "unknown"}`,
    );
  });
  return {
    repository,
    service,
    attempts,
    speakerNames,
    pages,
    hasCommand,
    async dispose(): Promise<void> {
      // Abort in-flight ingestions first: closing the connection underneath a
      // running attempt would strand its row in `running` forever.
      await service.shutdown().catch(() => undefined);
      database.close();
    },
  };
}
