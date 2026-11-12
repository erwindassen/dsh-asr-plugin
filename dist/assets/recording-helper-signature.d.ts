import type { SubprocessHandle, SubprocessSpawnSpec } from "@deepseek-ai/dsh-subprocess";
import type { RecordingHelperSignatureFacts, RecordingHelperSignatureInspectionInput, RecordingHelperSignatureInspector } from "./recording-helper-assets.js";
export interface CodesignResult {
    readonly output: string;
    readonly status: number | null;
}
export type CodesignRunner = (args: readonly string[], cwd: string) => Promise<CodesignResult>;
export interface CodesignSubprocess {
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
}
export declare function inspectRecordingHelperSignature(input: RecordingHelperSignatureInspectionInput, run: CodesignRunner): Promise<RecordingHelperSignatureFacts>;
export declare function createDshCodesignRunner(subprocess: CodesignSubprocess): CodesignRunner;
export declare function createDshRecordingHelperSignatureInspector(subprocess: CodesignSubprocess): RecordingHelperSignatureInspector;
