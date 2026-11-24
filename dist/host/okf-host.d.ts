import type { Context } from "@deepseek-ai/cordis";
import { type SpeakerNameRepository } from "../storage/speaker-name-repository.js";
import type { MeetingRepository } from "../storage/meeting-repository.js";
import { type OkfIngestionService, type OkfSettings } from "../okf/ingestion-service.js";
export interface OkfHostOptions {
    readonly databasePath: string;
    /** Unwrapped repository; the host returns a hooked wrapper for the application. */
    readonly repository: MeetingRepository;
    readonly settings: () => OkfSettings;
    readonly meeting: (meetingId: string) => {
        readonly meetingId: string;
        readonly title: string;
    } | null;
}
export interface OkfHost {
    /** Repository whose `commitTranscript` starts an automatic ingestion. */
    readonly repository: MeetingRepository;
    readonly service: OkfIngestionService;
    /** Per-meeting speaker attribution, shared with the recording panel RPC. */
    readonly speakerNames: SpeakerNameRepository;
    hasCommand: boolean;
    dispose(): Promise<void>;
}
/** Wires the ingestion slices into the running host; call once from `apply`. */
export declare function installOkfHost(context: Context, options: OkfHostOptions): OkfHost;
