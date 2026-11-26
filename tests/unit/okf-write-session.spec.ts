import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createPageWriteRegistry } from "../../src/okf/write-session.js";

const SESSION = "okf-ingest-1";
const MEETING_ID = "a4f7e766-928b-4a96-87d7-f81921fddd1c";

async function bundle(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "okf-write-"));
}

describe("createPageWriteRegistry", () => {
  it("writes into the bundle it opened and records every page", async () => {
    const root = await bundle();
    const pages = createPageWriteRegistry();
    pages.open(SESSION, { root, meetingId: MEETING_ID });

    await pages.write(SESSION, "meetings/2026-11-12-weekly-sync.md", "# Notes\n");
    await pages.write(SESSION, "actions/ship-it.md", "# Ship it\n");

    expect(pages.get(SESSION)).toEqual({
      sessionId: SESSION,
      root,
      meetingId: MEETING_ID,
      pages: ["actions/ship-it.md", "meetings/2026-11-12-weekly-sync.md"],
    });
    await expect(readFile(path.join(root, "actions/ship-it.md"), "utf8")).resolves.toBe("# Ship it\n");
  });

  it("stops writing once the child is released", async () => {
    const root = await bundle();
    const pages = createPageWriteRegistry();
    pages.open(SESSION, { root, meetingId: MEETING_ID });
    pages.close(SESSION);

    expect(pages.get(SESSION)).toBeUndefined();
    await expect(pages.write(SESSION, "meetings/2026-11-12-weekly-sync.md", "x")).rejects.toMatchObject({
      code: "OKF_PAGE_INVALID",
    });
  });

  it("keeps two running ingestions apart", async () => {
    const first = await bundle();
    const second = await bundle();
    const pages = createPageWriteRegistry();
    pages.open("session-a", { root: first, meetingId: MEETING_ID });
    pages.open("session-b", { root: second, meetingId: "b4c98e6e-1111-4111-8111-111111111111" });

    await pages.write("session-a", "meetings/a.md", "a\n");
    await pages.write("session-b", "meetings/b.md", "b\n");

    expect(pages.get("session-a")?.pages).toEqual(["meetings/a.md"]);
    expect(pages.get("session-b")?.pages).toEqual(["meetings/b.md"]);
    await expect(readFile(path.join(second, "meetings/a.md"), "utf8")).rejects.toThrow();
  });

  it("refuses an unknown session instead of writing anywhere", async () => {
    const pages = createPageWriteRegistry();
    await expect(pages.write("nobody", "meetings/a.md", "a\n")).rejects.toMatchObject({
      code: "OKF_PAGE_INVALID",
    });
  });
});
