import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import { type AudioDeviceInventoryRpc, type MeetingReferenceRpcCandidate, type MeetingReferenceRpcCandidatesPayload, type MeetingReferenceRpcResolvePayload, type RecordingRpcControlPayload, type RecordingRpcStateValue, type RecordingRpcView, type SaveSpeakerNamesRpcPayload, type SpeakerNamesRpcPayload, type SpeakerNamesRpcValue, type TranscriptExportRpcPayload, type TranscriptExportRpcValue } from "../recording/rpc-contract.js";
export declare function parseRecordingRpcView(value: unknown): RecordingRpcView;
export declare class RecordingRpcClient {
    private readonly rpc;
    constructor(rpc: ClientConnectionRpc);
    prepareModels(signal?: AbortSignal): Promise<void>;
    state(signal?: AbortSignal): Promise<RecordingRpcStateValue>;
    referenceCandidates(payload: MeetingReferenceRpcCandidatesPayload, signal?: AbortSignal): Promise<readonly MeetingReferenceRpcCandidate[]>;
    resolveMeetingReference(payload: MeetingReferenceRpcResolvePayload, signal?: AbortSignal): Promise<MeetingReferenceRpcCandidate>;
    control(payload: RecordingRpcControlPayload, signal?: AbortSignal): Promise<RecordingRpcView>;
    exportTranscript(payload: TranscriptExportRpcPayload, signal?: AbortSignal): Promise<TranscriptExportRpcValue>;
    /** Speaker label to display name for one meeting; unnamed labels are absent. */
    speakerNames(payload: SpeakerNamesRpcPayload, signal?: AbortSignal): Promise<SpeakerNamesRpcValue>;
    /** Replaces the stored attribution for one meeting; an empty map clears it. */
    saveSpeakerNames(payload: SaveSpeakerNamesRpcPayload, signal?: AbortSignal): Promise<SpeakerNamesRpcValue>;
    /** Lists CoreAudio devices through the signed helper. */
    listDevices(signal?: AbortSignal): Promise<AudioDeviceInventoryRpc>;
    /** Resolves the folder the user picked, or null when the dialog was cancelled. */
    chooseTranscriptDirectory(signal?: AbortSignal): Promise<string | null>;
    /** Resolves the Open knowledge base folder the user picked, or null when cancelled. */
    chooseOkfDirectory(signal?: AbortSignal): Promise<string | null>;
}
