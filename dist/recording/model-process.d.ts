import type { WorkerProcessHandle } from "../worker/process.js";
export declare class RecordingModelProcess {
    private readonly handle;
    private readonly fingerprint;
    private readonly onIdle;
    private readonly onExit;
    readonly ready: Promise<void>;
    private resolveReady;
    private rejectReady;
    private readyReceived;
    private active;
    private ended;
    constructor(handle: WorkerProcessHandle, fingerprint: string, onIdle: () => void, onExit: () => void);
    get busy(): boolean;
    open(meetingId: string, runId: string): WorkerProcessHandle;
    dispose(): Promise<void>;
    private sendInput;
    private receive;
    private finishSession;
    private exited;
}
