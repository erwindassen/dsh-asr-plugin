import type { CreateAgentOptions } from "@deepseek-ai/dsh-agent";
import type { OkfAgentPort } from "./contracts.js";
/** Skill the child agent must load before it writes any page. */
export declare const OKF_INGEST_SKILL_NAME = "okf";
/** Upper bound for one meeting ingestion; the host may shorten it. */
export declare const DEFAULT_OKF_AGENT_TIMEOUT_MS: number;
/**
 * The subset of an agent the ingestion needs. The real `AgentHandle` wraps an
 * `Agent`; the host adapter flattens `handle.agent` into this shape and turns
 * the instruction string into the runtime's user message.
 */
export interface OkfAgentHandle {
    followup(message: string): void;
    whenIdle(): Promise<void>;
    /** Optional: stop the child when the request is aborted. */
    interrupt?(): void;
    /** Optional: release the child once the ingestion settles. */
    dispose?(): Promise<void>;
}
export interface OkfAgentFactory {
    create(options: CreateAgentOptions): Promise<OkfAgentHandle>;
}
export interface OkfIngestionAgentDeps {
    readonly agents: OkfAgentFactory;
    readonly skillAvailable: (name: string) => boolean;
    readonly sessionId: () => string;
    readonly timeoutMs?: number;
}
/**
 * Dispatch one meeting to a child agent whose working directory is the OKF
 * bundle. The child writes summaries; this module only builds the instruction,
 * drives the child and maps its outcome.
 */
export declare function createOkfIngestionAgent(deps: OkfIngestionAgentDeps): OkfAgentPort;
