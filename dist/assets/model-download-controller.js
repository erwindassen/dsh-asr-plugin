import { ModelDownloadError, customModelProxy } from "./model-download-contract.js";
import { AssetVerificationError } from "./verify-assets.js";
import { installDownloadedModels } from "./model-download-operation.js";
export class ModelDownloadController {
    input;
    view = { pack: null, phase: "idle", downloadedBytes: 0,
        totalBytes: 0, jobId: null, errorCode: null };
    active;
    disposed = false;
    constructor(input) {
        this.input = input;
    }
    status() { return { ...this.view }; }
    async start(pack) {
        if (this.disposed)
            throw new ModelDownloadError("MODEL_DOWNLOAD_UNAVAILABLE");
        if (this.active !== undefined)
            throw new ModelDownloadError("MODEL_DOWNLOAD_BUSY");
        const settings = { ...this.input.settings() };
        customModelProxy(settings);
        const abort = new AbortController();
        const id = this.input.jobs.start({ kind: "asr-model-download", label: `Install ASR ${pack} models`,
            outputLimitBytes: 1_024, run: job => {
                this.view = { pack, phase: "downloading", downloadedBytes: 0, totalBytes: 0,
                    jobId: String(job.id), errorCode: null };
                const done = this.run(pack, settings, abort.signal, job);
                this.active = { abort, done };
                return { cancel: () => abort.abort(), done };
            } });
        this.view = { ...this.view, jobId: String(id) };
        return this.status();
    }
    async cancel() {
        const active = this.active;
        if (active !== undefined) {
            active.abort.abort();
            await active.done;
        }
        return this.status();
    }
    async dispose() { this.disposed = true; await this.cancel(); }
    async run(pack, settings, signal, job) {
        try {
            await installDownloadedModels({ ...this.input, pack, settings, signal, update: update => {
                    this.view = { ...this.view, ...update };
                    job.updateProgress(`${this.view.phase} ${this.view.downloadedBytes}/${this.view.totalBytes}`);
                } });
            this.view = { ...this.view, phase: "completed" };
            return { status: "completed" };
        }
        catch (error) {
            const code = downloadErrorCode(error);
            this.view = { ...this.view, phase: signal.aborted ? "cancelled" : "failed", errorCode: signal.aborted ? null : code };
            return { status: signal.aborted ? "killed" : "failed", detail: code };
        }
        finally {
            this.active = undefined;
        }
    }
}
function downloadErrorCode(error) {
    if (error instanceof ModelDownloadError || error instanceof AssetVerificationError)
        return error.code;
    if (error instanceof Error && "code" in error) {
        if (error.code === "ENOSPC")
            return "MODEL_DOWNLOAD_DISK_FULL";
        if (["EACCES", "EPERM", "EROFS"].includes(String(error.code)))
            return "MODEL_DOWNLOAD_STORAGE_DENIED";
    }
    return "MODEL_DOWNLOAD_FAILED";
}
//# sourceMappingURL=model-download-controller.js.map