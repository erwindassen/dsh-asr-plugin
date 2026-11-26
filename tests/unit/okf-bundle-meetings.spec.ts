import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { listBundleMeetingIds } from "../../src/okf/bundle-meetings.js";

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";

const roots: string[] = [];

async function bundle(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "dsh-okf-bundle-meetings-"));
  roots.push(root);
  await mkdir(path.join(root, "references", "transcripts"), { recursive: true });
  return root;
}

afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

describe("listBundleMeetingIds", () => {
  it("reads the meeting id from the transcript copy file name", async () => {
    const root = await bundle();
    await writeFile(path.join(root, "references", "transcripts", `${FIRST}.md`), "# Transcript\n");
    expect(await listBundleMeetingIds(root)).toEqual([FIRST]);
  });

  it("falls back to the frontmatter when the file name is not the id", async () => {
    const root = await bundle();
    await writeFile(
      path.join(root, "references", "transcripts", "renamed-by-hand.md"),
      `---\nmeeting_id: ${SECOND}\ntitle: "Weekly review"\n---\n\n# Transcript\n`,
    );
    expect(await listBundleMeetingIds(root)).toEqual([SECOND]);
  });

  it("ignores files without a meeting id and returns the ids sorted", async () => {
    const root = await bundle();
    await writeFile(path.join(root, "references", "transcripts", `${THIRD}.md`), "# Transcript\n");
    await writeFile(path.join(root, "references", "transcripts", `${FIRST}.md`), "# Transcript\n");
    await writeFile(path.join(root, "references", "transcripts", "notes.md"), "Loose notes\n");
    await writeFile(path.join(root, "references", "transcripts", "readme.txt"), FIRST);
    expect(await listBundleMeetingIds(root)).toEqual([FIRST, THIRD]);
  });

  it("treats a bundle without transcript copies as empty", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "dsh-okf-bundle-empty-"));
    roots.push(root);
    expect(await listBundleMeetingIds(root)).toEqual([]);
  });
});
