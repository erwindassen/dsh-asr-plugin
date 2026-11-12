import { PassThrough } from "node:stream";
import { decodeFrames, writeFrame } from "../worker/framing.js";
import { parseModelHostMessage } from "./model-messages.js";
import { runRecordingWorkerServer } from "./worker-server.js";
function invalid() {
    throw new Error("Recording model session is unavailable");
}
class RecordingModelServer {
    options;
    models;
    active;
    failed = false;
    constructor(options, models) {
        this.options = options;
        this.models = models;
    }
    async run() {
        await writeFrame(this.options.output, { type: "model_ready", model_protocol_version: 1, engine_fingerprint: this.models.engineFingerprint });
        for await (const raw of decodeFrames(this.options.input)) {
            if (this.failed)
                invalid();
            const message = parseModelHostMessage(raw);
            if (message.type === "begin")
                this.begin(message.meeting_id, message.run_id);
            else {
                const session = this.active;
                if (session === undefined || session.runId !== message.run_id || session.input.writableEnded)
                    invalid();
                if (message.type === "input_end")
                    session.input.end();
                else
                    await writeFrame(session.input, message.payload);
            }
        }
        return this.failed || this.active !== undefined ? 1 : 0;
    }
    async close() {
        this.active?.input.destroy(new Error("Recording model process stopped"));
        await this.active?.done;
    }
    begin(meetingId, runId) {
        if (this.active !== undefined)
            invalid();
        const input = new PassThrough();
        const output = new PassThrough();
        const diagnostics = new PassThrough();
        diagnostics.resume();
        const session = { runId, input, done: Promise.resolve() };
        this.active = session;
        session.done = this.execute(session, output, diagnostics, meetingId).catch(() => {
            this.failed = true;
            this.options.input.destroy(new Error("Recording model session failed"));
        });
    }
    async execute(session, output, diagnostics, meetingId) {
        const execution = runRecordingWorkerServer({ input: session.input, output, diagnostics,
            load: () => this.models.createSession(meetingId, session.runId) });
        const forwarding = (async () => {
            for await (const payload of decodeFrames(output)) {
                await writeFrame(this.options.output, { type: "output", run_id: session.runId, payload });
            }
        })();
        let exitCode;
        try {
            [exitCode] = await Promise.all([execution, forwarding]);
        }
        catch (error) {
            session.input.destroy(new Error("Recording model transport failed"));
            await Promise.allSettled([execution, forwarding]);
            throw error;
        }
        this.active = undefined;
        await writeFrame(this.options.output, { type: "session_end", run_id: session.runId, exit_code: exitCode });
        if (exitCode !== 0)
            throw new Error("Recording model runtime failed");
    }
}
export async function runRecordingModelServer(options) {
    let models;
    let server;
    try {
        models = await options.load();
        server = new RecordingModelServer(options, models);
        return await server.run();
    }
    catch {
        options.diagnostics.write("RECORDING_MODELS FAILED\n");
        return 1;
    }
    finally {
        try {
            await server?.close();
        }
        finally {
            try {
                await models?.close();
            }
            finally {
                options.output.end();
                options.diagnostics.end();
            }
        }
    }
}
//# sourceMappingURL=model-server.js.map