export type HClusterOptions = {
    height: number;
    k?: never;
} | {
    height?: never;
    k: number;
};
export interface HCluster {
    cluster(embeddings: readonly Float32Array[], options: HClusterOptions): readonly (readonly number[])[];
}
export declare function loadHCluster(binaryPath: string): HCluster;
