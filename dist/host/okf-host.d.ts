import type { Context } from "@deepseek-ai/cordis";
import { type OkfIngestionRepository } from "../storage/okf-ingestion-repository.js";
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
    /** Unwrapped repository; ingestion is user-driven, so commits start nothing. */
    readonly repository: MeetingRepository;
    readonly service: OkfIngestionService;
    /** Ingestion attempt log, shared with the recording panel's read model. */
    readonly attempts: OkfIngestionRepository;
    /** Per-meeting speaker attribution, shared with the recording panel RPC. */
    readonly speakerNames: SpeakerNameRepository;
    hasCommand: boolean;
    dispose(): Promise<void>;
}
/** Wires the ingestion slices into the running host; call once from `apply`. */
export declare function installOkfHost(context: Context, options: OkfHostOptions): OkfHost;
