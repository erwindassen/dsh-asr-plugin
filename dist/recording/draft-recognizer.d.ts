import type { LoadedVadModel } from "../asr/vad-model.js";
import { type LoadedFunAsrRuntime } from "../asr/funasr/pipeline.js";
import type { OnlineSpeakerLabeler } from "../diarization/online-labeler.js";
import type { RecordingDraftRecognizer } from "./draft-engine.js";
export declare function createRecordingDraftRecognizer(vad: LoadedVadModel, asr: LoadedFunAsrRuntime, speaker?: OnlineSpeakerLabeler): RecordingDraftRecognizer;
