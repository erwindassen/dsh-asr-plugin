import type { WorkerProcessHandle, WorkerSpawner } from "./process.js";
interface DshSpawnSpec {
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly stdio: {
        readonly stdin: "pipe";
        readonly stdout: "pipe";
        readonly stderr: "pipe";
    };
    readonly graceMs: number;
    readonly env: NodeJS.ProcessEnv;
}
export interface DshSubprocessPort {
    spawn(spec: DshSpawnSpec): WorkerProcessHandle;
}
export declare function createDshWorkerSpawner(subprocess: DshSubprocessPort): WorkerSpawner;
export {};
