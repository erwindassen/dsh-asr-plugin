import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  MAX_SYNC_MEETINGS,
  createStoredMeetingSync,
  type StoredMeetingSyncDeps,
} from "../../src/application/stored-meeting-sync.js";
import { OkfError } from "../../src/okf/contracts.js";
import type { MeetingRecord } from "../../src/storage/types.js";

const IN_FOLDER = "11111111-1111-4111-8111-111111111111";
const ONLY_IN_DATABASE = "22222222-2222-4222-8222-222222222222";
const ALSO_ONLY_IN_DATABASE = "33333333-3333-4333-8333-333333333333";

const roots: string[] = [];

async function bundle(ids: readonly string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "dsh-stored-meeting-sync-"));
  roots.push(root);
  const transcripts = path.join(root, "references", "transcripts");
  await mkdir(transcripts, { recursive: true });
  for (const id of ids) await writeFile(path.join(transcripts, `${id}.md`), "# Transcript\n");
  return root;
}

function meeting(meetingId: string, transcriptVersion: number): MeetingRecord {
  return { meetingId, transcriptVersion } as MeetingRecord;
}

function deps(directory: string, meetings: readonly MeetingRecord[]) {
  const remove = vi.fn(async () => undefined);
  const listStoredMeetings = vi.fn(() => meetings);
  const sync = createStoredMeetingSync({
    repository: { listStoredMeetings },
    remove,
    directory: () => directory,
  } satisfies StoredMeetingSyncDeps);
  return { sync, remove, listStoredMeetings };
}

afterAll(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

describe("createStoredMeetingSync", () => {
  it("counts the meetings the folder does not hold without removing anything", async () => {
    const directory = await bundle([IN_FOLDER]);
    const harness = deps(directory, [
      meeting(IN_FOLDER, 1),
      meeting(ONLY_IN_DATABASE, 3),
      meeting(ALSO_ONLY_IN_DATABASE, 2),
    ]);

    await expect(harness.sync.preview()).resolves.toEqual({ removed: 2, kept: 1 });
    expect(harness.remove).not.toHaveBeenCalled();
    expect(harness.listStoredMeetings).toHaveBeenCalledWith(MAX_SYNC_MEETINGS);
  });

  it("removes every meeting the folder does not hold with its transcript version", async () => {
    const directory = await bundle([IN_FOLDER]);
    const harness = deps(directory, [
      meeting(IN_FOLDER, 1),
      meeting(ONLY_IN_DATABASE, 3),
      meeting(ALSO_ONLY_IN_DATABASE, 2),
    ]);

    await expect(harness.sync.run()).resolves.toEqual({ removed: 2, kept: 1 });
    expect(harness.remove.mock.calls).toEqual([
      [ONLY_IN_DATABASE, 3],
      [ALSO_ONLY_IN_DATABASE, 2],
    ]);
  });

  it("keeps everything when the folder holds every meeting", async () => {
    const directory = await bundle([IN_FOLDER]);
    const harness = deps(directory, [meeting(IN_FOLDER, 1)]);
    await expect(harness.sync.run()).resolves.toEqual({ removed: 0, kept: 1 });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("matches a stored id even when the folder spells it in upper case", async () => {
    const directory = await bundle([IN_FOLDER.toUpperCase()]);
    const harness = deps(directory, [meeting(IN_FOLDER, 1)]);
    await expect(harness.sync.preview()).resolves.toEqual({ removed: 0, kept: 1 });
  });

  it("refuses to scan without a configured folder", async () => {
    const harness = deps("", [meeting(IN_FOLDER, 1)]);
    await expect(harness.sync.preview()).rejects.toMatchObject({
      code: "OKF_NOT_CONFIGURED",
    });
    expect(harness.remove).not.toHaveBeenCalled();
  });

  it("refuses to scan a folder that is not there", async () => {
    const harness = deps(path.join(tmpdir(), "dsh-sync-missing-folder"), [meeting(IN_FOLDER, 1)]);
    const failure = await harness.sync.run().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OkfError);
    expect(failure).toMatchObject({ code: "OKF_INVALID_DIRECTORY" });
    expect(harness.remove).not.toHaveBeenCalled();
  });
});
