import type { RecordingHelperTrackSnapshot, RecordingTrack } from "./recording-session.js";
interface EventBase {
    readonly eventSeq: number;
}
export type RecordingHelperEvent = (EventBase & {
    readonly type: "track_state";
    readonly track: RecordingTrack;
    readonly value: RecordingHelperTrackSnapshot;
}) | (EventBase & {
    readonly type: "helper_ready";
    readonly meetingId: string;
    readonly mic: RecordingHelperTrackSnapshot;
    readonly system: RecordingHelperTrackSnapshot;
}) | (EventBase & {
    readonly type: "chunk_closed";
    readonly endUs: number;
}) | (EventBase & {
    readonly type: "command_applied";
    readonly commandId: number;
    readonly errorCode: string | null;
    readonly mic: RecordingHelperTrackSnapshot;
    readonly result: "ok" | "error";
    readonly system: RecordingHelperTrackSnapshot;
}) | (EventBase & {
    readonly type: "helper_stopped";
}) | (EventBase & {
    readonly type: "helper_failed";
    readonly errorCode: string;
});
export declare class RecordingHelperProtocolError extends Error {
    readonly code: string;
    constructor(code?: string, options?: ErrorOptions);
}
export declare function parseRecordingHelperEvent(value: unknown, expectedSequence: number): RecordingHelperEvent;
export declare function readRecordingHelperEvent(path: string, expectedSequence: number): Promise<RecordingHelperEvent | null>;
export declare function readRecordingHelperControlFlag(path: string, key: "cancelled" | "normal_stop"): Promise<boolean>;
export {};
