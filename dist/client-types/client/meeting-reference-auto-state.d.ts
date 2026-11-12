export type AutoReferenceMode = "auto" | "suppressed";
export type MeetingInputPhase = "plain" | "adjudicating" | "claimed" | "submitting";
export interface AutoReferenceRuntimeState {
    readonly initialized: boolean;
    readonly inputPhase: MeetingInputPhase;
    readonly meetingId: string;
    readonly mode: AutoReferenceMode;
    readonly present: boolean;
}
export type AutoReferenceEvent = {
    readonly type: "restore" | "activate";
    readonly inputPhase: MeetingInputPhase;
    readonly meetingId: string;
    readonly mode?: AutoReferenceMode;
    readonly present: boolean;
} | {
    readonly type: "join";
    readonly meetingId: string;
} | {
    readonly type: "observe";
    readonly inputPhase: MeetingInputPhase;
    readonly present: boolean;
    readonly selfMutation: boolean;
} | {
    readonly type: "retire";
    readonly meetingId: string;
};
export interface AutoReferenceReduction {
    readonly effect: "none" | "insert";
    readonly state: AutoReferenceRuntimeState | null;
}
export declare function reduceAutoReference(state: AutoReferenceRuntimeState | null, event: AutoReferenceEvent): AutoReferenceReduction;
