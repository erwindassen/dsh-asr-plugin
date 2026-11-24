import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
/**
 * `minimumWidth` is the intrinsic width of the header: the panel never shrinks below it,
 * so the controls keep their size instead of being squeezed when the window opens.
 */
export declare function useRecordingPanelLayout(compactWidth: number, minimumWidth?: number): {
    expanded: boolean;
    style: CSSProperties;
    move: {
        onPointerDown(event: PointerEvent<HTMLButtonElement>): void;
        onPointerMove(event: PointerEvent<HTMLButtonElement>): void;
        onPointerUp(event: PointerEvent<HTMLButtonElement>): void;
        onLostPointerCapture(): void;
        onPointerCancel(): void;
        onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
    };
    resize: {
        onPointerDown(event: PointerEvent<HTMLButtonElement>): void;
        onPointerMove(event: PointerEvent<HTMLButtonElement>): void;
        onPointerUp(event: PointerEvent<HTMLButtonElement>): void;
        onLostPointerCapture(): void;
        onPointerCancel(): void;
        onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
    };
    toggle: () => void;
    reset: () => void;
};
