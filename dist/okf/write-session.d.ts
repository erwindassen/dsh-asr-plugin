import { type OkfWrittenPage } from "./page-writer.js";
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
export declare function createPageWriteRegistry(): OkfPageWriteRegistry;
