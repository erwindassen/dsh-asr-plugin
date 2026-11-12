import { constants } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { readRecordingHelperEvent, readRecordingHelperControlFlag, RecordingHelperProtocolError, } from "./helper-events.js";
const POLL_MS = 25;
const DIAGNOSTIC_BYTES = 4 * 1_024;
export class RecordingHelperClientError extends Error {
    code;
    constructor(code, options) {
        super("Recording helper failed", options);
        this.code = code;
        this.name = "RecordingHelperClientError";
    }
}
function assertOptions(options) {
    if (!isAbsolute(options.appRoot))
        throw new TypeError("Recording helper app path must be absolute");
    if (!Number.isSafeInteger(options.hostProcessId) ||
        options.hostProcessId < 2 || options.hostProcessId > 2_147_483_647) {
        throw new TypeError("Recording helper Host process id must be valid");
    }
    for (const timeout of [
        options.commandTimeoutMs,
        options.readyTimeoutMs,
        options.terminationTimeoutMs,
    ]) {
        if (!Number.isFinite(timeout) || timeout <= 0) {
            throw new TypeError("Recording helper timeout must be positive");
        }
    }
}
function clientError(error, fallback = "HELPER_PROCESS_ERROR") {
    if (error instanceof RecordingHelperClientError)
        return error;
    if (error instanceof RecordingHelperProtocolError) {
        return new RecordingHelperClientError(error.code, { cause: error });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
        typeof error.code === "string") {
        return new RecordingHelperClientError(error.code, { cause: error });
    }
    return new RecordingHelperClientError(fallback, { cause: error });
}
function delay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted === true) {
            reject(new RecordingHelperClientError("CANCELLED_BY_USER"));
            return;
        }
        const timer = setTimeout(done, milliseconds);
        const onAbort = () => done(new RecordingHelperClientError("CANCELLED_BY_USER"));
        function done(error) {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            if (error === undefined)
                resolve();
            else
                reject(error);
        }
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
async function fsyncDirectory(path) {
    const directory = await open(path, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
        await directory.sync();
    }
    finally {
        await directory.close();
    }
}
async function writeCommand(path, value) {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    let handle;
    try {
        handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT |
            constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        await rename(temporary, path);
        await fsyncDirectory(directory);
    }
    catch (error) {
        await handle?.close().catch(() => undefined);
        await unlink(temporary).catch(() => undefined);
        throw new RecordingHelperClientError("HELPER_IO_FAILED", { cause: error });
    }
}
function initialTrack() {
    return { requested: true, state: "starting", errorCode: null };
}
function failedTrack(track, code) {
    if (!track.requested || track.state === "failed")
        return track;
    return { requested: true, state: "failed", errorCode: code };
}
class ActiveRecordingHelperSession {
    options;
    handle;
    sessionRoot;
    meetingId;
    completion;
    acknowledgedCommandId = 0;
    captureEndUs = 0;
    commandId = 0;
    commandTail = Promise.resolve();
    failed = null;
    helperReady = false;
    mic = initialTrack();
    nextEvent = 1;
    outcome = null;
    pumpAbort = new AbortController();
    pumpTask;
    stopped = false;
    system = initialTrack();
    constructor(options, handle, sessionRoot, meetingId) {
        this.options = options;
        this.handle = handle;
        this.sessionRoot = sessionRoot;
        this.meetingId = meetingId;
        this.pumpTask = this.pump();
        this.completion = Promise.all([this.pumpTask, this.observeProcess()]).then(() => undefined);
        void this.completion.catch(() => undefined);
    }
    snapshot() {
        return { mic: this.mic, system: this.system, captureEndUs: this.captureEndUs };
    }
    waitUntilReady(signal) {
        return this.waitFor(() => this.helperReady && (this.mic.state === "on" || this.system.state === "on"), this.options.readyTimeoutMs, "HELPER_READY_TIMEOUT", signal).then(() => this);
    }
    setTrack(track, requested) {
        return this.enqueue(async () => {
            const current = this.snapshot()[track];
            const target = requested
                ? current.requested && (current.state === "on" || current.state === "starting")
                : !current.requested && current.state === "off";
            if (target)
                return this.snapshot();
            await this.issue(`${track}_${requested ? "on" : "off"}`);
            await this.waitFor(() => requested
                ? ["on", "failed"].includes(this.snapshot()[track].state)
                : this.snapshot()[track].state === "off", this.options.commandTimeoutMs, "HELPER_COMMAND_TIMEOUT");
            return this.snapshot();
        });
    }
    stop() {
        return this.enqueue(async () => {
            if (!this.stopped)
                await this.issue("stop");
            await this.waitFor(() => this.stopped, this.options.commandTimeoutMs, "HELPER_COMMAND_TIMEOUT");
            await this.waitForCleanExit();
            return this.snapshot();
        });
    }
    terminate() {
        return this.enqueue(async () => {
            try {
                if (this.outcome === null && !this.stopped) {
                    await this.issue("stop");
                    await this.waitFor(() => this.stopped, this.options.commandTimeoutMs, "HELPER_COMMAND_TIMEOUT");
                }
                if (!this.stopped)
                    throw new RecordingHelperClientError("HELPER_PROCESS_ERROR");
                await this.waitForTree();
            }
            catch {
                await this.forceTerminate();
            }
            finally {
                this.pumpAbort.abort();
                await this.pumpTask.catch(() => undefined);
            }
        });
    }
    async forceTerminate() {
        try {
            await writeCommand(join(this.sessionRoot, "control", "host-cancel.json"), {
                schema_version: 1, cancel: true,
            });
            await this.waitForCancellation();
            await this.waitForTree();
        }
        finally {
            this.pumpAbort.abort();
            await this.pumpTask.catch(() => undefined);
        }
    }
    async waitForCancellation() {
        const control = join(this.sessionRoot, "control");
        const deadline = performance.now() + this.options.terminationTimeoutMs;
        let protocolFailure;
        while (true) {
            try {
                if (await this.cancellationIsComplete(control))
                    return;
            }
            catch (error) {
                protocolFailure = clientError(error);
            }
            if (performance.now() >= deadline) {
                throw protocolFailure ?? new RecordingHelperClientError("HELPER_TERMINATION_TIMEOUT");
            }
            await delay(POLL_MS);
        }
    }
    async cancellationIsComplete(control) {
        if (await readRecordingHelperControlFlag(join(control, "host-cancelled.json"), "cancelled"))
            return true;
        return this.outcome !== null &&
            await readRecordingHelperControlFlag(join(control, "normal-stop.marker"), "normal_stop");
    }
    async pump() {
        try {
            while (!this.stopped) {
                const event = await this.readNext();
                this.apply(event);
                if (this.failed !== null)
                    throw this.failed;
            }
        }
        catch (error) {
            throw this.recordFailure(error);
        }
    }
    async observeProcess() {
        try {
            const outcome = await this.handle.done;
            this.outcome = outcome;
            if (outcome.exitCode !== 0 || outcome.signal !== null) {
                throw new RecordingHelperClientError("HELPER_PROCESS_ERROR");
            }
        }
        catch (error) {
            throw this.recordFailure(error);
        }
    }
    recordFailure(error) {
        this.failed ??= clientError(error);
        this.mic = failedTrack(this.mic, this.failed.code);
        this.system = failedTrack(this.system, this.failed.code);
        return this.failed;
    }
    async readNext() {
        const path = join(this.sessionRoot, "control", "events", `${this.nextEvent}.json`);
        while (true) {
            const event = await readRecordingHelperEvent(path, this.nextEvent);
            if (event !== null) {
                this.nextEvent += 1;
                return event;
            }
            if (this.failed !== null)
                throw this.failed;
            if (this.outcome !== null)
                throw new RecordingHelperClientError("HELPER_PROCESS_ERROR");
            await delay(POLL_MS, this.pumpAbort.signal);
        }
    }
    apply(event) {
        if (event.type === "track_state")
            this[event.track] = event.value;
        else if (event.type === "helper_ready") {
            if (event.meetingId !== this.meetingId)
                throw new RecordingHelperProtocolError();
            this.helperReady = true;
            this.mic = event.mic;
            this.system = event.system;
        }
        else if (event.type === "chunk_closed") {
            this.captureEndUs = Math.max(this.captureEndUs, event.endUs);
        }
        else if (event.type === "command_applied") {
            if (event.commandId !== this.commandId)
                throw new RecordingHelperProtocolError();
            this.acknowledgedCommandId = event.commandId;
            this.mic = event.mic;
            this.system = event.system;
            if (event.result === "error") {
                this.failed = new RecordingHelperClientError(event.errorCode ?? "COMMAND_APPLY_FAILED");
            }
        }
        else if (event.type === "helper_stopped")
            this.stopped = true;
        else
            this.failed = new RecordingHelperClientError(event.errorCode);
    }
    async issue(action) {
        if (this.failed !== null)
            throw this.failed;
        const commandId = this.commandId + 1;
        await writeCommand(join(this.sessionRoot, "control", "commands", `${commandId}.json`), {
            schema_version: 1,
            command_id: commandId,
            action,
        });
        this.commandId = commandId;
        await this.waitFor(() => this.failed !== null || this.acknowledgedCommandId >= commandId, this.options.commandTimeoutMs, "HELPER_COMMAND_TIMEOUT");
        if (this.failed !== null)
            throw this.failed;
    }
    async waitFor(predicate, timeoutMs, timeoutCode, signal) {
        const deadline = performance.now() + timeoutMs;
        while (!predicate()) {
            if (this.failed !== null)
                throw this.failed;
            if (signal?.aborted === true)
                throw new RecordingHelperClientError("CANCELLED_BY_USER");
            if (performance.now() >= deadline)
                throw new RecordingHelperClientError(timeoutCode);
            await delay(Math.min(POLL_MS, deadline - performance.now()), signal);
        }
    }
    async waitForCleanExit() {
        await this.waitFor(() => this.outcome !== null, this.options.terminationTimeoutMs, "HELPER_TERMINATION_TIMEOUT");
        if (this.outcome?.exitCode !== 0 || this.outcome.signal !== null) {
            throw new RecordingHelperClientError("HELPER_PROCESS_ERROR");
        }
        await this.waitForTree();
    }
    async waitForTree() {
        const exited = await this.handle.waitForExit(AbortSignal.timeout(this.options.terminationTimeoutMs));
        if (!exited) {
            this.handle.terminate();
            throw new RecordingHelperClientError("HELPER_TERMINATION_TIMEOUT");
        }
    }
    enqueue(operation) {
        const next = this.commandTail.then(operation, operation);
        this.commandTail = next.then(() => undefined, () => undefined);
        return next;
    }
}
export class RecordingHelperClient {
    options;
    constructor(options) {
        this.options = options;
        assertOptions(options);
    }
    async start(input) {
        if (input.signal.aborted)
            throw new RecordingHelperClientError("CANCELLED_BY_USER");
        const sessionRoot = input.layout.meetingDirectory;
        const handle = this.options.subprocess.spawn({
            argv: [
                "/usr/bin/open", "-n", "-W", this.options.appRoot, "--args",
                sessionRoot, input.meetingId, String(this.options.hostProcessId),
            ],
            cwd: dirname(this.options.appRoot),
            stdio: {
                stdin: "ignore",
                stdout: { maxBytes: DIAGNOSTIC_BYTES },
                stderr: { maxBytes: DIAGNOSTIC_BYTES },
            },
            graceMs: this.options.terminationTimeoutMs,
        });
        const active = new ActiveRecordingHelperSession(this.options, handle, sessionRoot, input.meetingId);
        try {
            return await active.waitUntilReady(input.signal);
        }
        catch (error) {
            await active.forceTerminate();
            throw clientError(error);
        }
    }
}
//# sourceMappingURL=helper-client.js.map