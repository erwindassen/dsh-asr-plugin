export class ProgressOutput {
    startedAtMs;
    now;
    stageValue = "validating";
    percentValue = 0;
    terminal = false;
    unread;
    constructor(startedAtMs, now) {
        this.startedAtMs = startedAtMs;
        this.now = now;
        this.unread = this.render();
    }
    get stage() {
        return this.stageValue;
    }
    update(stage, percent) {
        if (this.terminal)
            return;
        this.stageValue = stage;
        this.percentValue = Math.max(this.percentValue, Math.min(100, Math.round(percent)));
        this.unread = this.render();
    }
    finish(stage, errorCode) {
        if (this.terminal)
            return;
        this.stageValue = stage;
        if (errorCode === undefined)
            this.percentValue = 100;
        this.terminal = true;
        this.unread = this.render(errorCode);
    }
    read() {
        const value = this.unread;
        this.unread = "";
        return value;
    }
    render(errorCode) {
        const elapsedMs = Math.max(0, this.now() - this.startedAtMs);
        return JSON.stringify({
            stage: this.stageValue,
            percent: this.percentValue,
            elapsed_ms: elapsedMs,
            ...(errorCode === undefined ? {} : { error_code: errorCode }),
        });
    }
}
export function workerPercent(kind, message) {
    const spans = kind === "asr"
        ? { vad: [30, 45], asr: [45, 65] }
        : {
            fbank: [70, 75], embed: [75, 82], cluster: [82, 87], assign: [87, 92],
        };
    const span = spans[message.stage];
    if (span === undefined)
        return kind === "asr" ? 30 : 70;
    return span[0] + (span[1] - span[0]) * message.ratio;
}
//# sourceMappingURL=meeting-run-progress.js.map