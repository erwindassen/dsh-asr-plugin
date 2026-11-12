import type { RecordingFinalizeMessage, RecordingWorkerToHostMessage } from "./worker-types.js";
export type ModelHostMessage = {
    readonly type: "begin";
    readonly meeting_id: string;
    readonly run_id: string;
} | {
    readonly type: "input";
    readonly run_id: string;
    readonly payload: RecordingFinalizeMessage;
} | {
    readonly type: "input_end";
    readonly run_id: string;
};
export type ModelWorkerMessage = {
    readonly type: "model_ready";
    readonly model_protocol_version: 1;
    readonly engine_fingerprint: string;
} | {
    readonly type: "output";
    readonly run_id: string;
    readonly payload: RecordingWorkerToHostMessage;
} | {
    readonly type: "session_end";
    readonly run_id: string;
    readonly exit_code: 0 | 1;
};
export declare function parseModelHostMessage(value: unknown): ModelHostMessage;
export declare function parseModelWorkerMessage(value: unknown): ModelWorkerMessage;
