export const STDERR_TAIL_BYTES = 64 * 1024;
export async function drainStderrTail(stream, maxBytes = STDERR_TAIL_BYTES) {
    const chunks = [];
    let retainedBytes = 0;
    let totalBytes = 0;
    try {
        for await (const rawChunk of stream) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            totalBytes += chunk.byteLength;
            chunks.push(chunk);
            retainedBytes += chunk.byteLength;
            while (retainedBytes > maxBytes) {
                const head = chunks[0];
                const excess = retainedBytes - maxBytes;
                if (head.byteLength <= excess) {
                    chunks.shift();
                    retainedBytes -= head.byteLength;
                }
                else {
                    chunks[0] = head.subarray(excess);
                    retainedBytes -= excess;
                }
            }
        }
    }
    catch {
        // Diagnostics must never hide the protocol or process outcome.
    }
    return {
        text: Buffer.concat(chunks, retainedBytes).toString("utf8"),
        truncated: totalBytes > maxBytes,
    };
}
//# sourceMappingURL=stderr-tail.js.map