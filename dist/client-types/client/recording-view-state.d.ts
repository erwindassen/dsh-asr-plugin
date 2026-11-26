import type { RecordingRpcView } from "../recording/rpc-contract.js";
/** A live recording owns the draft area, so stored transcripts stay inactive. */
export declare function isRecordingActive(view: RecordingRpcView | null): boolean;
