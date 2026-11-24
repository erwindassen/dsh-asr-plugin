import type { OkfFile, OkfRollupInput } from "./contracts.js";
export { readOkfPages, type OkfRollupPages } from "./rollup-read.js";
/** Deterministic rollup pages; the caller writes them over the previous set. */
export declare function renderRollups(input: OkfRollupInput): readonly OkfFile[];
