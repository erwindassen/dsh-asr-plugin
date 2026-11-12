import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
export declare function useRecordingPanelLayout(compactWidth: number): {
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
