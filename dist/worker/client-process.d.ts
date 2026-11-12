import type { Readable, Writable } from "node:stream";
import type { WorkerLaunchSpec, WorkerProcessHandle, WorkerProcessOutcome } from "./process.js";
import type { StderrTail } from "./stderr-tail.js";
export interface WorkerSessionStreams {
    readonly stdin: Writable;
    readonly stdout: Readable;
    readonly stderr: Readable;
}
export interface WorkerFailureSettlement {
    readonly outcome?: WorkerProcessOutcome;
    readonly quiet: boolean;
}
export declare const EMPTY_STDERR: StderrTail;
export declare class WorkerWaitFailure<P extends string = string> extends Error {
    readonly reason: "cancelled" | "timeout";
    readonly phase: P;
    constructor(reason: "cancelled" | "timeout", phase: P);
}
export declare class WorkerProcessFailure extends Error {
}
export declare function assertPositiveTimeout(value: number): void;
export declare function assertWorkerLaunch(spec: WorkerLaunchSpec): void;
export declare function requireWorkerStreams(handle: WorkerProcessHandle): WorkerSessionStreams;
export declare function waitBounded<T, P extends string>(promise: Promise<T>, signal: AbortSignal | undefined, deadline: number, phase: P): Promise<T>;
export declare function waitAbortable<T, P extends string>(promise: Promise<T>, signal: AbortSignal | undefined, phase: P): Promise<T>;
export declare function closeWorkerInput(stream: Writable): Promise<void>;
export declare function destroyWorkerStreams(handle: WorkerProcessHandle): void;
export declare function settleWorkerFailure(handle: WorkerProcessHandle, timeoutMs: number): Promise<WorkerFailureSettlement>;
export declare function requireWorkerTreeExit<P extends string>(handle: WorkerProcessHandle, signal: AbortSignal | undefined, deadline: number, phase: P, timeoutMs: number): Promise<void>;
