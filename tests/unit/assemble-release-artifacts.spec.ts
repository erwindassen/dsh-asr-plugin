import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assembleReleaseArtifacts,
  missingReleasePayload,
  releaseArtifactFiles,
} from "../../scripts/assemble-release-artifacts.mjs";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })));
});

/** Write one source tree whose `files` allowlist exercises every shape. */
async function fixture({ withEntry }: { withEntry: boolean }) {
  const root = await mkdtemp(join(tmpdir(), "dsh-release-"));
  roots.push(root);
  const write = async (path: string, content = "x") => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), content);
  };
  await write("package.json", JSON.stringify({
    name: "@huliux/dsh-asr-plugin",
    version: "1.0.0",
    files: ["dist", "!dist/probes/**", "locale/*.json", "docs/one.md", "assets/prompts", "LICENSE"],
  }, null, 2));
  await write("LICENSE", "license");
  await write("dist/index.js", "export {};");
  await write("dist/okf/paths.js");
  await write("dist/probes/probe.js");
  await write("locale/en.json", "{}");
  await write("locale/zh.json", "{}");
  await write("locale/notes.txt");
  await write("docs/one.md", "# one");
  await write("docs/two.md", "# two");
  await write("assets/prompts/okf-ingest.md", "prompt");
  if (!withEntry) await rm(join(root, "dist/index.js"));
  return root;
}

describe("releaseArtifactFiles", () => {
  it("follows the package allowlist, its negations and its globs", async () => {
    const root = await fixture({ withEntry: true });

    const files = await releaseArtifactFiles(root);

    expect(files).toContain("dist/index.js");
    expect(files).toContain("dist/okf/paths.js");
    expect(files).toContain("locale/en.json");
    expect(files).toContain("assets/prompts/okf-ingest.md");
    expect(files).toContain("package.json");
    expect(files).not.toContain("dist/probes/probe.js");
    expect(files).not.toContain("locale/notes.txt");
    expect(files).not.toContain("docs/two.md");
    expect(files).toEqual([...files].sort());
  });
});

describe("missingReleasePayload", () => {
  it("names every runtime file a JavaScript-only build lacks", async () => {
    const root = await fixture({ withEntry: true });

    expect(await missingReleasePayload(root)).toEqual([
      "dist/recording-helper/DSHASRRecordingHelper.app/Contents/MacOS/DSHASRRecordingHelper",
      "dist/recording-helper/manifest.json",
      "dist/native/darwin-arm64/fbank.node",
      "dist/native/darwin-arm64/hcluster.node",
    ]);
  });

  it("accepts a tree built by the closed-pilot release build", async () => {
    const root = await fixture({ withEntry: true });
    for (const relative of [
      "dist/recording-helper/DSHASRRecordingHelper.app/Contents/MacOS/DSHASRRecordingHelper",
      "dist/recording-helper/manifest.json",
      "dist/native/darwin-arm64/fbank.node",
      "dist/native/darwin-arm64/hcluster.node",
    ]) {
      await mkdir(join(root, relative, ".."), { recursive: true });
      await writeFile(join(root, relative), "binary");
    }

    expect(await missingReleasePayload(root)).toEqual([]);
  });
});

describe("assembleReleaseArtifacts", () => {
  it("copies the allowlist and stamps the release version", async () => {
    const root = await fixture({ withEntry: true });
    const out = join(root, ".release");

    const count = await assembleReleaseArtifacts({ root, out, version: "0.2.0-fork.7" });

    expect(count).toBeGreaterThan(0);
    const manifest = JSON.parse(await readFile(join(out, "package.json"), "utf8"));
    expect(manifest.version).toBe("0.2.0-fork.7");
    expect(manifest.files).toHaveLength(6);
    expect(await readFile(join(out, "dist/index.js"), "utf8")).toBe("export {};");
    await expect(readFile(join(out, "dist/probes/probe.js"), "utf8")).rejects.toThrow();
  });

  it("replaces an earlier tree instead of merging into it", async () => {
    const root = await fixture({ withEntry: true });
    const out = join(root, ".release");
    await assembleReleaseArtifacts({ root, out, version: "0.1.0" });
    await writeFile(join(out, "stale.js"), "old");

    await assembleReleaseArtifacts({ root, out, version: "0.2.0" });

    await expect(readFile(join(out, "stale.js"), "utf8")).rejects.toThrow();
    const manifest = JSON.parse(await readFile(join(out, "package.json"), "utf8"));
    expect(manifest.version).toBe("0.2.0");
  });

  it("refuses a version that is not semver", async () => {
    const root = await fixture({ withEntry: true });

    await expect(assembleReleaseArtifacts({ root, out: join(root, ".release"), version: "v0.2.0.fork" }))
      .rejects.toThrow(/not X\.Y\.Z/u);
  });

  it("refuses an unbuilt tree", async () => {
    const root = await fixture({ withEntry: false });

    await expect(assembleReleaseArtifacts({ root, out: join(root, ".release"), version: "0.2.0" }))
      .rejects.toThrow(/no dist\/index\.js/u);
  });
});
