/**
 * Assemble the prebuilt package tree that the `release/desktop` branch carries.
 *
 * A package fetched from Git is built by the fetcher, and pnpm refuses build
 * scripts it has not allowlisted by exact URL, so a source tag cannot be
 * installed without local setup. This script produces the installable tree
 * instead: the built `dist/`, the shipped assets, docs and notices, taken from
 * the package's own `files` allowlist so the artifacts branch and the npm
 * tarball cannot drift apart.
 *
 * @module scripts/assemble-release-artifacts
 */

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Version strings accepted for an artifact tree. */
export const RELEASE_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u;

/**
 * Files a release must carry besides the compiled JavaScript.
 *
 * `pnpm run build` produces only TypeScript output, so a tree assembled from it
 * installs but cannot record: the helper bundle is missing and macOS never lists
 * `DSHASRRecordingHelper` for permissions. `pnpm run build:closed-pilot` builds
 * these, and a release that lacks them is refused instead of published.
 */
export const REQUIRED_RELEASE_PAYLOAD = Object.freeze([
  "dist/recording-helper/DSHASRRecordingHelper.app/Contents/MacOS/DSHASRRecordingHelper",
  "dist/recording-helper/manifest.json",
  "dist/native/darwin-arm64/fbank.node",
  "dist/native/darwin-arm64/hcluster.node",
]);

/** Expand one `files` entry into repository-relative paths. */
async function expand(root, entry) {
  if (entry.endsWith("/**")) {
    const directory = entry.slice(0, -3);
    const files = [];
    const walk = async (relative) => {
      for (const name of await readdir(join(root, relative)).catch(() => [])) {
        const child = posix.join(relative, name);
        const info = await stat(join(root, child));
        if (info.isDirectory()) await walk(child);
        else files.push(child);
      }
    };
    await walk(directory);
    return files;
  }
  if (entry.includes("*")) {
    const directory = join(root, posix.dirname(entry));
    const name = posix.basename(entry);
    const star = name.indexOf("*");
    const prefix = name.slice(0, star);
    const suffix = name.slice(star + 1);
    const found = await readdir(directory).catch(() => []);
    return found
      .filter((candidate) => candidate.startsWith(prefix) && candidate.endsWith(suffix))
      .map((candidate) => join(posix.dirname(entry), candidate));
  }
  const info = await stat(join(root, entry)).catch(() => null);
  if (info === null) throw new Error(`The package manifest lists ${entry}, which does not exist`);
  if (!info.isDirectory()) return [entry];
  const files = [];
  const walk = async (directory) => {
    for (const name of await readdir(join(root, directory))) {
      const child = join(directory, name);
      const childInfo = await stat(join(root, child));
      if (childInfo.isDirectory()) await walk(child);
      else files.push(child);
    }
  };
  await walk(entry);
  return files;
}

/**
 * Resolve the files the artifacts tree must contain.
 *
 * @param root - repository root.
 * @returns repository-relative paths, sorted, with no duplicates.
 */
export async function releaseArtifactFiles(root) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const included = new Set();
  const excluded = [];
  for (const entry of manifest.files ?? []) {
    if (entry.startsWith("!")) {
      excluded.push(...(await expand(root, entry.slice(1)).catch(() => [])));
      continue;
    }
    for (const path of await expand(root, entry)) included.add(path);
  }
  for (const path of excluded) included.delete(path);
  included.add("package.json");
  return [...included].sort();
}

/**
 * List the required runtime payload files that `root` does not carry.
 *
 * @param root - directory holding a built plugin tree.
 * @returns repository-relative paths that are missing or not regular files.
 */
export async function missingReleasePayload(root) {
  const missing = [];
  for (const relative of REQUIRED_RELEASE_PAYLOAD) {
    const info = await stat(join(root, relative)).catch(() => null);
    if (info === null || !info.isFile()) missing.push(relative);
  }
  return missing;
}

/**
 * Copy the artifact files into `out` and stamp the release version.
 *
 * @param options - repository root, output directory and release version.
 * @returns the number of files written.
 */
export async function assembleReleaseArtifacts({ root, out, version }) {
  if (!RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(`Release version ${JSON.stringify(version)} is not X.Y.Z or X.Y.Z-suffix`);
  }
  const files = await releaseArtifactFiles(root);
  if (!files.includes(join("dist", "index.js"))) {
    throw new Error("The artifacts tree has no dist/index.js; build the plugin first");
  }
  await rm(out, { recursive: true, force: true });
  for (const file of files) {
    const destination = join(out, file.split(sep).join("/"));
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, file), destination);
  }
  const manifestPath = join(out, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = version;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return files.length;
}

/** Parse `--name value` pairs. */
function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === undefined || !key.startsWith("--") || value === undefined) {
      throw new Error(`Usage: assemble-release-artifacts --out <dir> --version <X.Y.Z[-suffix]> (got ${key ?? "nothing"})`);
    }
    options[key.slice(2)] = value;
  }
  return options;
}

const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === resolve(fileURLToPath(import.meta.url))) {
  const options = parseArgs(process.argv.slice(2));
  if (options.version === undefined) throw new Error("--version is required");
  const out = resolve(options.out ?? ".release");
  const root = process.cwd();
  const missing = await missingReleasePayload(root);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to assemble ${root}: it is missing ${missing.join(", ")}. ` +
        "Build the release with `pnpm run build:closed-pilot`, which also produces the native addons and the recording helper.",
    );
  }
  const count = await assembleReleaseArtifacts({ root, out, version: options.version });
  console.log(`Assembled ${count} files for ${options.version} in ${out}`);
}
