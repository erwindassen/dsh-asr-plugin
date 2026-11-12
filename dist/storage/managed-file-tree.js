import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
async function pathBytes(path) {
    let stats;
    try {
        stats = await lstat(path);
    }
    catch (error) {
        if (error.code === "ENOENT")
            return 0;
        throw error;
    }
    if (stats.isFile())
        return stats.size;
    if (!stats.isDirectory())
        return 0;
    const entries = await readdir(path);
    const sizes = await Promise.all(entries.map((entry) => pathBytes(join(path, entry))));
    return sizes.reduce((total, size) => total + size, 0);
}
export async function managedTreeBytes(meetingDirectory, workDirectory) {
    const [meetingBytes, workBytes] = await Promise.all([
        pathBytes(meetingDirectory),
        pathBytes(workDirectory),
    ]);
    return meetingBytes + workBytes;
}
//# sourceMappingURL=managed-file-tree.js.map