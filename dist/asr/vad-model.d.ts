import type { VadInferenceModel } from "./bounded-vad.js";
export interface LoadedVadModel extends VadInferenceModel {
    close(): Promise<void>;
}
export declare function loadVadModel(modelPath: string): Promise<LoadedVadModel>;
