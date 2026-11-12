import type { ClientConnectionRpc } from "@deepseek-ai/dsh-client-connection/client";
import { type MeetingReferenceRpcCandidate, type MeetingReferenceRpcCandidatesPayload, type MeetingReferenceRpcResolvePayload, type RecordingRpcControlPayload, type RecordingRpcStateValue, type RecordingRpcView } from "../recording/rpc-contract.js";
export declare function parseRecordingRpcView(value: unknown): RecordingRpcView;
export declare class RecordingRpcClient {
    private readonly rpc;
    constructor(rpc: ClientConnectionRpc);
    prepareModels(signal?: AbortSignal): Promise<void>;
    state(signal?: AbortSignal): Promise<RecordingRpcStateValue>;
    referenceCandidates(payload: MeetingReferenceRpcCandidatesPayload, signal?: AbortSignal): Promise<readonly MeetingReferenceRpcCandidate[]>;
    resolveMeetingReference(payload: MeetingReferenceRpcResolvePayload, signal?: AbortSignal): Promise<MeetingReferenceRpcCandidate>;
    control(payload: RecordingRpcControlPayload, signal?: AbortSignal): Promise<RecordingRpcView>;
}
