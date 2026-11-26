import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { OkfError } from "../../src/okf/contracts.js";
import {
  assertWritablePage,
  OKF_PAGE_MAX_BYTES,
  writeOkfPage,
} from "../../src/okf/page-writer.js";

const MEETING_PAGE = "meetings/2026-11-12-weekly-sync.md";

async function bundle(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "okf-page-"));
}

describe("assertWritablePage", () => {
  it("accepts the page folders the writer owns", () => {
    for (const page of [
      MEETING_PAGE,
      "actions/ship-the-release.md",
      "deadlines/2026-12-01-review.md",
      "entities/person/erwin.md",
      "concepts/transcript-lifecycle.md",
      "sources/a4f7e766-928b-4a96-87d7-f81921fddd1c.md",
    ]) {
      expect(() => { assertWritablePage(page); }).not.toThrow();
    }
  });

  it("refuses the rollups, the transcript copies and anything outside them", () => {
    for (const page of [
      "index.md",
      "meetings/index.md",
      "actions/index.md",
      "references/transcripts/weekly-sync.md",
      "src/index.md",
      "meetings/weekly-sync.txt",
      "meetings",
    ]) {
      expect(() => { assertWritablePage(page); }).toThrow(OkfError);
    }
  });
});

describe("writeOkfPage", () => {
  it("creates the parent folders and writes the page", async () => {
    const root = await bundle();
    const written = await writeOkfPage(root, "entities/person/erwin.md", "# Erwin\n");

    expect(written).toEqual({ relativePath: "entities/person/erwin.md", bytes: 8 });
    await expect(readFile(path.join(root, "entities/person/erwin.md"), "utf8")).resolves.toBe("# Erwin\n");
  });

  it("replaces an existing page and leaves no temporary file behind", async () => {
    const root = await bundle();
    await writeOkfPage(root, MEETING_PAGE, "first\n");
    await writeOkfPage(root, MEETING_PAGE, "second\n");

    await expect(readFile(path.join(root, MEETING_PAGE), "utf8")).resolves.toBe("second\n");
    const names = await readdir(path.join(root, "meetings"));
    expect(names).toEqual(["2026-11-12-weekly-sync.md"]);
  });

  it("refuses a path that escapes the bundle", async () => {
    const root = await bundle();
    await expect(writeOkfPage(root, "meetings/../../outside.md", "x")).rejects.toMatchObject({
      code: "OKF_PATH_ESCAPE",
    });
    await expect(writeOkfPage(root, "../outside.md", "x")).rejects.toBeInstanceOf(OkfError);
  });

  it("refuses a page larger than the cap instead of writing a partial one", async () => {
    const root = await bundle();
    const oversized = "x".repeat(OKF_PAGE_MAX_BYTES + 1);
    await expect(writeOkfPage(root, MEETING_PAGE, oversized)).rejects.toMatchObject({
      code: "OKF_PAGE_TOO_LARGE",
    });
    await expect(readFile(path.join(root, MEETING_PAGE), "utf8")).rejects.toThrow();
  });

  it("keeps a symlinked parent from smuggling the write outside the bundle", async () => {
    const root = await bundle();
    const outside = await bundle();
    await writeFile(path.join(outside, "notes.md"), "outside\n");
    const { symlink } = await import("node:fs/promises");
    await symlink(outside, path.join(root, "meetings"));

    await expect(writeOkfPage(root, MEETING_PAGE, "x")).rejects.toMatchObject({
      code: "OKF_PATH_ESCAPE",
    });
  });
});
