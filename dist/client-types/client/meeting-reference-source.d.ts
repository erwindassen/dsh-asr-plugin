import type { InputTriggerSource } from "@deepseek-ai/dsh-client-ui-input-trigger/client";
import type { MeetingReferenceRpcPhase } from "../recording/rpc-contract.js";
import type { RecordingRpcClient } from "./recording-rpc-client.js";
export interface MeetingReferenceIdentity {
    readonly meetingId: string;
    readonly label: string;
}
export type MeetingReferenceTranslationKey = "auto.current" | "section.meetings" | `phase.${MeetingReferenceRpcPhase}` | "time.duration" | "time.elapsed";
type TranslateMeetingReference = (key: MeetingReferenceTranslationKey, params?: Readonly<Record<string, string>>) => string;
interface MeetingReferenceSourceOptions {
    readonly client: RecordingRpcClient;
    readonly hasReference: (sessionId: string, meetingId: string) => boolean;
    readonly locale: () => string;
    readonly translate: TranslateMeetingReference;
}
export declare function formatMeetingReference(identity: MeetingReferenceIdentity): string;
export declare function parseMeetingReference(mention: string): MeetingReferenceIdentity;
export declare function durationClock(milliseconds: number): string;
export declare function createMeetingReferenceSource(options: MeetingReferenceSourceOptions): InputTriggerSource;
export {};
