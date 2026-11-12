import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkerEnvironment } from "../worker/launch.js";
export function createPackagedRecordingWorkerLaunch(options) {
    const workerDirectory = dirname(fileURLToPath(import.meta.url));
    return {
        argv: [
            process.execPath,
            resolve(workerDirectory, "recording-entry.js"),
            options.modelRoot,
            options.packagedNativeRoot,
            options.manifestPath,
            options.meetingsRoot,
            options.workRoot,
            options.meetingId,
            options.runId,
            options.expectedFingerprint,
            ...(options.processing === undefined ? [] : [JSON.stringify(options.processing)]),
        ],
        cwd: workerDirectory,
        environment: createWorkerEnvironment(),
        graceMs: options.graceMs,
    };
}
//# sourceMappingURL=launch.js.map