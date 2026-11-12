import type { Readable } from "node:stream";
export declare const STDERR_TAIL_BYTES: number;
export interface StderrTail {
    readonly text: string;
    readonly truncated: boolean;
}
export declare function drainStderrTail(stream: Readable, maxBytes?: number): Promise<StderrTail>;
