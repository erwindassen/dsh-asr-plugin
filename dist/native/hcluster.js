import { createRequire } from "node:module";
import { resolve } from "node:path";
import { NativeAdapterError } from "./errors.js";
function invalidInput(message) {
    throw new NativeAdapterError("NATIVE_INPUT_INVALID", "hcluster", message);
}
function assertEmbeddings(embeddings) {
    if (!Array.isArray(embeddings) || embeddings.length === 0) {
        invalidInput("hcluster requires at least one embedding");
    }
    for (const embedding of embeddings) {
        if (!(embedding instanceof Float32Array) || embedding.length !== 256) {
            invalidInput("hcluster embeddings must be 256-dimensional Float32Arrays");
        }
        for (const value of embedding) {
            if (!Number.isFinite(value)) {
                invalidInput("hcluster embeddings must contain only finite values");
            }
        }
    }
}
function assertOptions(options, count) {
    if (typeof options !== "object" || options === null) {
        invalidInput("hcluster options are required");
    }
    const hasK = options.k !== undefined;
    const hasHeight = options.height !== undefined;
    if (hasK === hasHeight)
        invalidInput("provide exactly one of k or height");
    if (hasK && (!Number.isSafeInteger(options.k) || options.k < 1 || options.k > count)) {
        invalidInput("hcluster k must be an integer between 1 and embedding count");
    }
    if (hasHeight && (!Number.isFinite(options.height) || options.height <= 0)) {
        invalidInput("hcluster height must be a positive finite number");
    }
}
function formatClusters(value, count) {
    if (typeof value !== "object" || value === null)
        return invalidOutput();
    const labels = value.labels;
    if (!Array.isArray(labels) ||
        labels.length !== count ||
        labels.some((label) => !Number.isSafeInteger(label) || label < 0 || label >= count)) {
        return invalidOutput();
    }
    const clusters = new Map();
    labels.forEach((label, index) => {
        const cluster = clusters.get(label) ?? [];
        cluster.push(index);
        clusters.set(label, cluster);
    });
    return [...clusters.values()];
}
function invalidOutput() {
    throw new NativeAdapterError("NATIVE_OUTPUT_INVALID", "hcluster", "hcluster returned invalid labels");
}
function loadModule(binaryPath) {
    try {
        const value = createRequire(import.meta.url)(resolve(binaryPath));
        if (typeof value !== "object" ||
            value === null ||
            typeof value.HCluster !== "function") {
            throw new Error("HCluster export is missing");
        }
        return value;
    }
    catch (error) {
        throw new NativeAdapterError("NATIVE_LOAD_FAILED", "hcluster", "hcluster native module failed to load", { cause: error });
    }
}
export function loadHCluster(binaryPath) {
    const nativeModule = loadModule(binaryPath);
    return {
        cluster(embeddings, options) {
            assertEmbeddings(embeddings);
            assertOptions(options, embeddings.length);
            if (embeddings.length === 1)
                return [[0]];
            try {
                const instance = new nativeModule.HCluster([...embeddings]);
                return formatClusters(instance.cluster(options), embeddings.length);
            }
            catch (error) {
                if (error instanceof NativeAdapterError)
                    throw error;
                throw new NativeAdapterError("NATIVE_EXECUTION_FAILED", "hcluster", "hcluster native execution failed", { cause: error });
            }
        },
    };
}
//# sourceMappingURL=hcluster.js.map