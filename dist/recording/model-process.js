import { PassThrough } from "node:stream";
import { decodeFrames, writeFrame } from "../worker/framing.js";
import { waitBounded } from "../worker/client-process.js";
import { drainStderrTail } from "../worker/stderr-tail.js";
import { parseModelWorkerMessage } from "./model-messages.js";
function channel(runId) {
    let settle;
    const done = new Promise(resolve => { settle = resolve; });
    return { runId, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), done, settle };
}
export class RecordingModelProcess {
    handle;
    fingerprint;
    onIdle;
    onExit;
    ready;
    resolveReady;
    rejectReady;
    readyReceived = false;
    active;
    ended = false;
    constructor(handle, fingerprint, onIdle, onExit) {
        this.handle = handle;
        this.fingerprint = fingerprint;
        this.onIdle = onIdle;
        this.onExit = onExit;
        this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
        void this.ready.catch(() => undefined);
        if (handle.stderr !== undefined)
            void drainStderrTail(handle.stderr);
        void this.receive().catch(() => undefined).finally(() => { handle.terminate(); return this.exited(); });
    }
    get busy() { return this.active !== undefined; }
    open(meetingId, runId) {
        if (!this.readyReceived || this.ended || this.active !== undefined)
            throw new Error("Recording models are unavailable");
        const session = channel(runId);
        this.active = session;
        void this.sendInput(session, meetingId).catch(() => this.handle.terminate());
        return { stdin: session.stdin, stdout: session.stdout, stderr: session.stderr, done: session.done,
            terminate: () => this.handle.terminate(),
            waitForExit: async (signal) => {
                try {
                    await waitBounded(session.done, signal ?? new AbortController().signal, performance.now() + 5_000, "termination");
                    return true;
                }
                catch {
                    return false;
                }
            },
        };
    }
    async dispose() {
        this.handle.terminate();
        const signal = AbortSignal.timeout(5_000);
        if (!await this.handle.waitForExit(signal))
            throw new Error("Recording model process did not stop");
    }
    async sendInput(session, meetingId) {
        const stdin = this.handle.stdin;
        if (stdin === undefined)
            throw new Error("Recording model input is missing");
        await writeFrame(stdin, { type: "begin", meeting_id: meetingId, run_id: session.runId });
        for await (const payload of decodeFrames(session.stdin)) {
            await writeFrame(stdin, { type: "input", run_id: session.runId, payload });
        }
        await writeFrame(stdin, { type: "input_end", run_id: session.runId });
    }
    async receive() {
        if (this.handle.stdout === undefined)
            throw new Error("Recording model output is missing");
        for await (const raw of decodeFrames(this.handle.stdout)) {
            const message = parseModelWorkerMessage(raw);
            if (message.type === "model_ready") {
                if (this.readyReceived || message.engine_fingerprint !== this.fingerprint)
                    throw new Error("Recording model identity mismatch");
                this.readyReceived = true;
                this.resolveReady();
            }
            else {
                const session = this.active;
                if (!this.readyReceived || session === undefined || session.runId !== message.run_id)
                    throw new Error("Recording model session mismatch");
                if (message.type === "output")
                    await writeFrame(session.stdout, message.payload);
                else
                    this.finishSession(session, message.exit_code);
            }
        }
    }
    finishSession(session, exitCode) {
        this.active = undefined;
        session.stdin.destroy();
        session.stdout.end();
        session.stderr.end();
        session.settle({ exitCode, signal: null });
        if (exitCode === 0)
            this.onIdle();
        else
            this.handle.terminate();
    }
    async exited() {
        this.ended = true;
        const outcome = await this.handle.done.catch(() => ({ exitCode: 1, signal: null }));
        this.rejectReady(new Error("Recording model process exited before readiness"));
        const session = this.active;
        this.active = undefined;
        if (session !== undefined) {
            session.stdin.destroy();
            session.stdout.end();
            session.stderr.end();
            session.settle({ exitCode: 1, signal: outcome.signal });
        }
        this.onExit();
    }
}
//# sourceMappingURL=model-process.js.map