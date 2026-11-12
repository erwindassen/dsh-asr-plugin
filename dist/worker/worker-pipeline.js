import { WorkerProtocolError } from "./host-state.js";
import { WorkerClientError } from "./worker-client.js";
function runOptions(options, kind) {
    return {
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.onProgress === undefined
            ? {}
            : { onProgress: (message) => options.onProgress(kind, message) }),
        ...(options.onReady === undefined
            ? {}
            : { onReady: (message) => options.onReady(kind, message) }),
    };
}
function assertNotCancelled(signal) {
    if (signal?.aborted === true)
        throw WorkerClientError.cancelled("run");
}
function diarizationRun(options, asr) {
    return {
        type: "run",
        request_id: options.diarizationRequestId,
        kind: "diarization",
        base_transcript_version: options.asrRun.base_transcript_version,
        payload: {
            audio_path: options.asrRun.payload.audio_path,
            duration_ms: options.asrRun.payload.duration_ms,
            blocks: asr.payload.blocks,
            speech_regions: asr.payload.speech_regions,
        },
    };
}
export async function runWorkerPipeline(options) {
    assertNotCancelled(options.signal);
    const asr = await options.asr.run(options.asrRun, runOptions(options, "asr"));
    if (asr.kind !== "asr")
        throw new WorkerProtocolError();
    assertNotCancelled(options.signal);
    if (asr.payload.blocks.length === 0)
        return { type: "empty", asr };
    options.onHandoff?.();
    const diarization = await options.diarization.run(diarizationRun(options, asr), runOptions(options, "diarization"));
    if (diarization.kind !== "diarization")
        throw new WorkerProtocolError();
    return { type: "diarized", asr, diarization };
}
//# sourceMappingURL=worker-pipeline.js.map