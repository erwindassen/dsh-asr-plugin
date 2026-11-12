import { spawn } from "node:child_process";
function signalTree(child, signal) {
    if (child.pid === undefined)
        return;
    if (process.platform !== "win32") {
        try {
            process.kill(-child.pid, signal);
            return;
        }
        catch {
            // Fall back to the direct child if its process group has already gone.
        }
    }
    try {
        child.kill(signal);
    }
    catch {
        // Idempotent termination treats an already-gone child as success.
    }
}
function waitForSettlement(done, isSettled, signal) {
    if (isSettled())
        return Promise.resolve(true);
    if (signal?.aborted === true)
        return Promise.resolve(false);
    return new Promise((resolve) => {
        const finish = (value) => {
            signal?.removeEventListener("abort", onAbort);
            resolve(value);
        };
        const onAbort = () => finish(false);
        signal?.addEventListener("abort", onAbort, { once: true });
        done.then(() => finish(true), () => finish(true));
    });
}
function spawnNodeWorker(spec) {
    const [command, ...args] = spec.argv;
    if (command === undefined)
        throw new TypeError("Worker argv must contain an executable");
    const child = spawn(command, args, {
        cwd: spec.cwd,
        detached: process.platform !== "win32",
        env: { ...spec.environment },
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
    });
    let settled = false;
    let escalation;
    const done = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (exitCode, signal) => {
            settled = true;
            if (escalation !== undefined)
                clearTimeout(escalation);
            resolve({ exitCode, signal });
        });
    });
    return {
        stdin: child.stdin ?? undefined,
        stdout: child.stdout ?? undefined,
        stderr: child.stderr ?? undefined,
        done,
        terminate() {
            if (settled || escalation !== undefined)
                return;
            signalTree(child, "SIGTERM");
            escalation = setTimeout(() => signalTree(child, "SIGKILL"), spec.graceMs);
        },
        waitForExit(signal) {
            return waitForSettlement(done, () => settled, signal);
        },
    };
}
export function createNodeWorkerSpawner() {
    return { spawn: spawnNodeWorker };
}
//# sourceMappingURL=node-spawner.js.map