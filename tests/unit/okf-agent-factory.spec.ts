import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { describe, expect, it } from "vitest";

import { OkfError } from "../../src/okf/contracts.js";
import { createPageWriteRegistry } from "../../src/okf/write-session.js";
import { okfAgentFactory } from "../../src/host/okf-host.js";

const MEETING_ID = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
const SESSION_ID = "okf-ingest-session-1";

interface FakeAgent {
  readonly followups: unknown[];
  readonly idle: Promise<void>;
  readonly cancelled: unknown[];
  readonly disposed: { value: boolean };
}

interface Harness {
  readonly factory: ReturnType<typeof okfAgentFactory>;
  readonly pages: ReturnType<typeof createPageWriteRegistry>;
  readonly created: unknown[];
  readonly agent: FakeAgent;
}

function harness(overrides: {
  readonly selection?: unknown;
  readonly preset?: string;
  readonly createError?: unknown;
} = {}): Harness {
  const created: unknown[] = [];
  const agent: FakeAgent = {
    followups: [],
    idle: Promise.resolve(),
    cancelled: [],
    disposed: { value: false },
  };
  const handle = {
    agent: {
      followup: (message: unknown) => { agent.followups.push(message); },
      whenIdle: () => agent.idle,
      cancel: (cause: unknown) => { agent.cancelled.push(cause); },
    },
    dispose: async () => { agent.disposed.value = true; },
  };
  const agents = {
    async create(options: unknown) {
      created.push(options);
      if (overrides.createError !== undefined) throw overrides.createError;
      return handle;
    },
  };
  const services: Record<string, unknown> = {
    agents,
    agentDefaultModel: {
      currentSelection: () => overrides.selection ?? { provider: "siliconflow", model: "deepseek-ai/DeepSeek-V4", reasoningEffort: "medium" },
    },
    agentPresets: { composedPreset: () => overrides.preset },
  };
  const context = {
    get: (name: string) => services[name],
    inject: (_names: readonly string[], callback: (scope: { agents: typeof agents }) => unknown) => callback({ agents }),
  } as unknown as Context;
  const pages = createPageWriteRegistry();
  return { factory: okfAgentFactory(context, pages), pages, created, agent };
}

async function bundle(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "okf-agent-factory-"));
}

describe("okfAgentFactory", () => {
  it("routes the child at the configured default model and the composed preset", async () => {
    const test = harness({ preset: "standard" });
    const root = await bundle();
    const handle = await test.factory.create(
      { sessionId: SESSION_ID as never, meta: { cwd: root, origin: "subagent" } },
      { meetingId: MEETING_ID, directory: root },
    );

    expect(test.created).toEqual([{
      sessionId: SESSION_ID,
      meta: { cwd: root, origin: "subagent", agentPreset: "standard" },
      agentOptions: { provider: "siliconflow", model: "deepseek-ai/DeepSeek-V4", reasoningEffort: "medium" },
    }]);
    handle.followup("summarise this");
    expect(test.agent.followups).toHaveLength(1);
  });

  it("lends the child a writer for this bundle and withdraws it on dispose", async () => {
    const test = harness();
    const root = await bundle();
    const handle = await test.factory.create(
      { sessionId: SESSION_ID as never },
      { meetingId: MEETING_ID, directory: root },
    );

    expect(test.pages.get(SESSION_ID)).toMatchObject({ root, meetingId: MEETING_ID, pages: [] });
    await test.pages.write(SESSION_ID, "meetings/2026-11-12-weekly-sync.md", "# Notes\n");
    expect(test.pages.get(SESSION_ID)?.pages).toEqual(["meetings/2026-11-12-weekly-sync.md"]);

    await handle.dispose?.();
    expect(test.pages.get(SESSION_ID)).toBeUndefined();
    expect(test.agent.disposed.value).toBe(true);
  });

  it("opens no writer when the child could not be created", async () => {
    const test = harness({ createError: new Error("session store refused the id") });
    const root = await bundle();
    await expect(test.factory.create(
      { sessionId: SESSION_ID as never },
      { meetingId: MEETING_ID, directory: root },
    )).rejects.toThrow("session store refused the id");
    expect(test.pages.get(SESSION_ID)).toBeUndefined();
  });

  it("names the missing model instead of creating an unroutable child", async () => {
    const test = harness({ selection: {} });
    const root = await bundle();
    await expect(test.factory.create(
      { sessionId: SESSION_ID as never },
      { meetingId: MEETING_ID, directory: root },
    )).rejects.toBeInstanceOf(OkfError);
    expect(test.created).toHaveLength(0);
  });

  it("cancels the child through its own driver when the request is interrupted", async () => {
    const test = harness();
    const root = await bundle();
    const handle = await test.factory.create(
      { sessionId: SESSION_ID as never },
      { meetingId: MEETING_ID, directory: root },
    );
    handle.interrupt?.();
    expect(test.agent.cancelled).toHaveLength(1);
  });
});
