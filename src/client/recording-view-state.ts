import type { RecordingRpcView } from "../recording/rpc-contract.js";

/** A live recording owns the draft area, so stored transcripts stay inactive. */
export function isRecordingActive(view: RecordingRpcView | null): boolean {
  return view?.phase === "starting" || view?.phase === "recording" || view?.phase === "finalizing";
}
