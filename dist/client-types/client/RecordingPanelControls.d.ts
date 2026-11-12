import type { PanelViewProps } from "./RecordingPanelView.js";
import { recordingIcons } from "./recording-icon-assets.js";
export declare function RecordingIcon({ name }: {
    readonly name: keyof typeof recordingIcons;
}): import("react/jsx-runtime").JSX.Element;
export declare function RecordingControls(props: PanelViewProps): import("react/jsx-runtime").JSX.Element;
