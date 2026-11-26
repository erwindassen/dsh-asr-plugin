/**
 * Lists the meetings a bundle actually holds.
 *
 * The plugin's own transcript copies are the only machine-authored pages in the
 * bundle, so they are the trustworthy answer to "which meetings live in this
 * folder". Pages under `meetings/` are written by a model and are deliberately
 * ignored here: a hand-edited or hallucinated page must never resurrect or drop
 * a stored meeting.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseFrontmatter } from "./frontmatter-read.js";
import { OKF_TRANSCRIPTS_DIRECTORY } from "./paths.js";

const MEETING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Bundle roots whose copies could not be read simply hold no meetings. */
export async function listBundleMeetingIds(root: string): Promise<readonly string[]> {
  const directory = join(root, OKF_TRANSCRIPTS_DIRECTORY);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const stem = entry.name.slice(0, -".md".length).toLowerCase();
    if (MEETING_ID.test(stem)) {
      ids.add(stem);
      continue;
    }
    // A copy renamed by hand still carries its id in the frontmatter.
    const content = await readFile(join(directory, entry.name), "utf8").catch(() => "");
    const field = parseFrontmatter(content).fields["meeting_id"];
    const candidate = typeof field === "string" ? field.trim().toLowerCase() : "";
    if (MEETING_ID.test(candidate)) ids.add(candidate);
  }
  return [...ids].sort();
}
