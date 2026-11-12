import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const WORKER_ENVIRONMENT_KEYS = [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "ELECTRON_RUN_AS_NODE",
    "DYLD_LIBRARY_PATH",
    "LD_LIBRARY_PATH",
    "SystemRoot",
    "WINDIR",
    "USERPROFILE",
];
export function createWorkerEnvironment(source = process.env) {
    const environment = {};
    for (const key of WORKER_ENVIRONMENT_KEYS) {
        const value = source[key];
        if (value !== undefined)
            environment[key] = value;
    }
    return environment;
}
export function createPackagedWorkerLaunch(options) {
    const workerDirectory = dirname(fileURLToPath(import.meta.url));
    return {
        argv: [
            process.execPath,
            resolve(workerDirectory, `${options.kind}-entry.js`),
            options.modelRoot,
            options.packagedNativeRoot,
            options.manifestPath,
            options.managedAudioDirectory,
            ...(options.processing === undefined ? [] : [JSON.stringify(options.processing)]),
        ],
        cwd: workerDirectory,
        environment: createWorkerEnvironment(),
        graceMs: options.graceMs,
    };
}
//# sourceMappingURL=launch.js.map