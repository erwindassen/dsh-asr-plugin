import { OkfError } from "./contracts.js";
import { type OkfWrittenPage, writeOkfPage } from "./page-writer.js";

/** Where one summarising child writes, and what it has written so far. */
export interface OkfWriteSession {
  readonly sessionId: string;
  /** Canonical bundle root; every page resolves under it. */
  readonly root: string;
  readonly meetingId: string;
  readonly pages: readonly string[];
}

export interface OkfWriteSessionSeed {
  readonly root: string;
  readonly meetingId: string;
}

interface ActiveSession extends OkfWriteSessionSeed {
  readonly pages: Set<string>;
}

/**
 * Which child agent may write which bundle.
 *
 * The summarising agent runs in its own session with no filesystem tools, so the
 * plugin lends it exactly one: a page writer that can only touch this bundle,
 * only under the page folders, and only while that ingestion is running. The
 * registry keeps that authority per session id and drops it in `close`, which
 * the agent factory calls when the child is disposed.
 */
export interface OkfPageWriteRegistry {
  open(sessionId: string, seed: OkfWriteSessionSeed): void;
  close(sessionId: string): void;
  get(sessionId: string): OkfWriteSession | undefined;
  write(sessionId: string, relativePath: string, content: string): Promise<OkfWrittenPage>;
}

function unknownSession(): OkfError {
  return new OkfError(
    "OKF_PAGE_INVALID",
    "okf_write_page only writes pages while a meeting is being summarised",
  );
}

export function createPageWriteRegistry(): OkfPageWriteRegistry {
  const sessions = new Map<string, ActiveSession>();

  const registry: OkfPageWriteRegistry = {
    open(sessionId, seed) {
      sessions.set(sessionId, { root: seed.root, meetingId: seed.meetingId, pages: new Set<string>() });
    },

    close(sessionId) {
      sessions.delete(sessionId);
    },

    get(sessionId) {
      const active = sessions.get(sessionId);
      if (active === undefined) return undefined;
      return {
        sessionId,
        root: active.root,
        meetingId: active.meetingId,
        pages: [...active.pages].sort(),
      };
    },

    async write(sessionId, relativePath, content) {
      const active = sessions.get(sessionId);
      if (active === undefined) throw unknownSession();
      const written = await writeOkfPage(active.root, relativePath, content);
      active.pages.add(written.relativePath);
      return written;
    },
  };

  return registry;
}
