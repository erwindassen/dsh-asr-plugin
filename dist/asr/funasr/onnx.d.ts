import * as ort from "onnxruntime-node";
export declare function createSession(modelPath: string, inputNames: readonly string[], outputNames: readonly string[]): Promise<ort.InferenceSession>;
export declare function disposeResults(results: ort.InferenceSession.ReturnType | undefined): void;
export declare function requireFloatTensor(value: ort.OnnxValue | undefined, name: string): ort.TypedTensor<"float32">;
export declare function requireInt32Tensor(value: ort.OnnxValue | undefined, name: string): ort.TypedTensor<"int32">;
export declare function argmaxRows(data: Float32Array, rows: number, columns: number): Int32Array;
