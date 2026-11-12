import { parseProcessingLaunch } from "./processing-launch.js";
import { isAbsolute } from "node:path";
import { WorkerRuntimeError } from "./worker-errors.js";
const MAX_PATH_LENGTH = 4_096;
function entryPath(value) {
    if (value === undefined ||
        value.length === 0 ||
        value.length > MAX_PATH_LENGTH ||
        !isAbsolute(value))
        throw new WorkerRuntimeError("INVALID_REQUEST", "Worker entry path is invalid");
    return value;
}
export function parseWorkerEntryConfig(argv) {
    if (argv.length !== 4 && argv.length !== 5) {
        throw new WorkerRuntimeError("INVALID_REQUEST", "Worker entry requires four paths");
    }
    return {
        ...(argv[4] === undefined ? {} : { processing: parseProcessingLaunch(argv[4]) }),
        modelRoot: entryPath(argv[0]),
        packagedNativeRoot: entryPath(argv[1]),
        manifestPath: entryPath(argv[2]),
        managedAudioDirectory: entryPath(argv[3]),
    };
}
//# sourceMappingURL=entry-config.js.map