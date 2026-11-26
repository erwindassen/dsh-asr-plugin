import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { ToolArgsError, type ToolDefinition } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";

import { createPageWriteRegistry } from "../../src/okf/write-session.js";
import { OKF_WRITE_PAGE_TOOL, registerOkfTools } from "../../src/tools/okf-tools.js";

const SESSION = "okf-ingest-1";
const MEETING_ID = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
const MEETING_PAGE = "meetings/2026-11-12-weekly-sync.md";

interface Harness {
  readonly tool: ToolDefinition;
  readonly pages: ReturnType<typeof createPageWriteRegistry>;
  write(args: Record<string, unknown>, session?: string): Promise<unknown>;
}

async function harness(): Promise<Harness> {
  const registered: ToolDefinition[] = [];
  const pages = createPageWriteRegistry();
  registerOkfTools(
    {
      tools: {
        register: (definition: ToolDefinition) => {
          registered.push(definition);
          return () => undefined;
        },
      },
    } as unknown as Context,
    { pages },
  );
  const tool = registered[0];
  if (tool === undefined) throw new Error("okf_write_page was not registered");
  return {
    tool,
    pages,
    async write(args, session) {
      const exec = session === undefined ? {} : { agent: { session: { id: session } } };
      return await tool.execute(args as never, exec as never);
    },
  };
}

async function bundle(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "okf-tool-"));
}

describe("registerOkfTools", () => {
  it("registers the one writer the child agent gets", async () => {
    const test = await harness();
    expect(test.tool.name).toBe(OKF_WRITE_PAGE_TOOL);
    expect(test.tool.description).toContain("meetings/");
    expect(test.tool.description).toContain("index.md");
  });

  it("writes the page for the session the host opened", async () => {
    const root = await bundle();
    const test = await harness();
    test.pages.open(SESSION, { root, meetingId: MEETING_ID });

    const result = await test.write({ path: MEETING_PAGE, content: "# Weekly sync\n" }, SESSION);

    expect(result).toEqual({ relative_path: MEETING_PAGE, bytes: 14 });
    await expect(readFile(path.join(root, MEETING_PAGE), "utf8")).resolves.toBe("# Weekly sync\n");
  });

  it("refuses to run outside a summarising session", async () => {
    const test = await harness();
    await expect(test.write({ path: MEETING_PAGE, content: "x" })).rejects.toThrow(
      "only runs inside a summarising agent session",
    );
  });

  it("refuses a session that has no ingestion open, and says so", async () => {
    const test = await harness();
    await expect(test.write({ path: MEETING_PAGE, content: "x" }, "someone-else")).rejects.toThrow(
      "only writes pages while a meeting is being summarised",
    );
  });

  it("passes the layout refusal on so the child can correct its path", async () => {
    const root = await bundle();
    const test = await harness();
    test.pages.open(SESSION, { root, meetingId: MEETING_ID });

    await expect(test.write({ path: "meetings/index.md", content: "x" }, SESSION)).rejects.toThrow(
      "is a rollup the plugin regenerates",
    );
    await expect(test.write({ path: "references/transcripts/x.md", content: "x" }, SESSION)).rejects.toThrow(
      "is outside the page folders",
    );
  });

  it("rejects an argument the schema does not declare", async () => {
    const test = await harness();
    await expect(test.write({ path: MEETING_PAGE, content: "x", overwrite: true }, SESSION)).rejects.toBeInstanceOf(
      ToolArgsError,
    );
  });
});
