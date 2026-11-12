import { isAbsolute } from "node:path";
import { finished } from "node:stream/promises";
export const EMPTY_STDERR = { text: "", truncated: false };
export class WorkerWaitFailure extends Error {
    reason;
    phase;
    constructor(reason, phase) {
        super(`Worker wait ${reason}`);
        this.reason = reason;
        this.phase = phase;
    }
}
export class WorkerProcessFailure extends Error {
}
export function assertPositiveTimeout(value) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
        throw new TypeError("Worker timeouts must be positive safe timer values");
    }
}
export function assertWorkerLaunch(spec) {
    if (spec.argv.length === 0 ||
        spec.argv.some((item) => item.length === 0) ||
        !isAbsolute(spec.cwd))
        throw new TypeError("Worker launch spec is invalid");
    assertPositiveTimeout(spec.graceMs);
}
export function requireWorkerStreams(handle) {
    if (handle.stdin === undefined || handle.stdout === undefined || handle.stderr === undefined) {
        throw new WorkerProcessFailure("Worker protocol requires three pipes");
    }
    return { stdin: handle.stdin, stdout: handle.stdout, stderr: handle.stderr };
}
export async function waitBounded(promise, signal, deadline, phase) {
    if (signal?.aborted === true)
        throw new WorkerWaitFailure("cancelled", phase);
    const remaining = deadline - performance.now();
    if (remaining <= 0)
        throw new WorkerWaitFailure("timeout", phase);
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (operation) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            operation();
        };
        const onAbort = () => finish(() => reject(new WorkerWaitFailure("cancelled", phase)));
        const timer = setTimeout(() => finish(() => reject(new WorkerWaitFailure("timeout", phase))), remaining);
        signal?.addEventListener("abort", onAbort, { once: true });
        promise.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
    });
}
export async function waitAbortable(promise, signal, phase) {
    if (signal === undefined)
        return promise;
    if (signal.aborted)
        throw new WorkerWaitFailure("cancelled", phase);
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (operation) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener("abort", onAbort);
            operation();
        };
        const onAbort = () => finish(() => reject(new WorkerWaitFailure("cancelled", phase)));
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then((value) => finish(() => resolve(value)), (error) => finish(() => reject(error)));
    });
}
export async function closeWorkerInput(stream) {
    stream.end();
    await finished(stream, { cleanup: true, readable: false });
}
export function destroyWorkerStreams(handle) {
    handle.stdin?.destroy();
    handle.stdout?.destroy();
    handle.stderr?.destroy();
}
async function settlePromise(promise, timeoutMs) {
    const deadline = performance.now() + timeoutMs;
    try {
        return await waitBounded(promise, undefined, deadline, "termination");
    }
    catch {
        return undefined;
    }
}
export async function settleWorkerFailure(handle, timeoutMs) {
    try {
        handle.terminate();
    }
    catch {
        destroyWorkerStreams(handle);
        return { quiet: false };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let quiet = false;
    try {
        quiet = await handle.waitForExit(controller.signal);
    }
    catch {
        quiet = false;
    }
    finally {
        clearTimeout(timer);
    }
    const outcome = await settlePromise(handle.done, timeoutMs);
    destroyWorkerStreams(handle);
    return { quiet, ...(outcome === undefined ? {} : { outcome }) };
}
export async function requireWorkerTreeExit(handle, signal, deadline, phase, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const exited = await waitBounded(handle.waitForExit(controller.signal), signal, deadline, phase);
        if (!exited)
            throw new WorkerProcessFailure("Worker process tree remained live");
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=client-process.js.map