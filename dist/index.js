import { ModelDownloadController } from "./assets/model-download-controller.js";
import { readModelSettings } from "./assets/model-settings.js";
import { chmod, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dshHomePath, expandHomePath } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";
import { MeetingApplication, } from "./application/meeting-application.js";
import { resolveConfiguredRuntimeAssets, resolveRuntimeAssets } from "./assets/runtime-assets.js";
import { fingerprintAssetManifest } from "./assets/verify-assets.js";
import { createDshRecordingHelperSignatureInspector } from "./assets/recording-helper-signature.js";
import { effectiveConfig, readVolatile, refreshSettingsOnActivation, registerConfigUpdates } from "./host/cordis-config.js";
import { createProductRecordingFactories } from "./recording/product-factories.js";
import { RecordingModelWorker } from "./recording/model-worker.js";
import { registerRecordingHostRpc } from "./recording/host-rpc.js";
import { createMacDirectoryPicker } from "./transcripts/directory-picker.js";
import { createTranscriptExportControl } from "./transcripts/transcript-export-control.js";
import { installOkfHost } from "./host/okf-host.js";
import { createStoredMeetingPanel } from "./application/stored-meeting-panel.js";
import { createStoredMeetingSync } from "./application/stored-meeting-sync.js";
import { panelIngestion } from "./okf/panel-ingestion.js";
import { admittingThrough, recordingHttpConnection } from "./recording/http-connection.js";
import { acquireDataRootLease } from "./storage/data-root-lease.js";
import { openManagedAudioStore } from "./storage/managed-audio-store.js";
import { openMeetingRepository, } from "./storage/meeting-repository.js";
import { registerMeetingTools } from "./tools/meeting-tools.js";
import { registerOkfTools } from "./tools/okf-tools.js";
import { createDshWorkerSpawner } from "./worker/dsh-spawner.js";
import { createPackagedWorkerLaunch } from "./worker/launch.js";
import { WORKER_READY_TIMEOUT_MS, WORKER_TERMINATION_GRACE_MS, WORKER_TERMINATION_TIMEOUT_MS, workerRunDeadlineMs, } from "./worker/timeouts.js";
import { WorkerClient } from "./worker/worker-client.js";
export const name = "dsh-asr";
export const inject = ["tools", "jobs", "subprocess"];
const DEFAULT_DATA_DIRECTORY = dshHomePath("dsh-asr-plugin");
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST_PATH = fileURLToPath(new URL("./assets/manifest.json", import.meta.url));
export const Config = z.object({
    asr_engine: z.union(["paraformer", "parakeet"]).default("paraformer").volatile()
        .description("Recognizer family; Paraformer covers Chinese, Parakeet covers 25 European languages"),
    punctuation_enabled: z.boolean().volatile().description("Legacy setting; punctuation is now selected from installed models"),
    hf_download_route: z.union(["default", "direct", "proxy"]).default("default").volatile()
        .description("Legacy route; downloads automatically select pinned sources"),
    hf_proxy_url: z.string().default("").volatile(),
    hf_proxy_kind: z.union(["mirror", "http"]).volatile(),
    data_dir: z.string().default(DEFAULT_DATA_DIRECTORY),
    transcript_directory: z.string().default("").volatile()
        .description("Default folder for exported transcripts; empty asks on export"),
    okf_directory: z.string().default("").volatile()
        .description("Folder holding the Open knowledge base bundle; empty disables ingestion"),
    okf_ingest: z.boolean().default(true).volatile()
        .description("Legacy setting; ingestion now starts from the recording panel or /asr-ingest"),
    mic_device_uid: z.string().default("").volatile()
        .description("Microphone device UID; empty follows the macOS default input"),
    system_device_uid: z.string().default("").volatile()
        .description("System-audio device UID; empty follows the macOS default output"),
});
function configuredDirectory(field, value, fallback) {
    const selected = value ?? fallback;
    if (selected.trim().length === 0)
        throw new Error(`dsh-asr: ${field} must not be empty`);
    return resolve(expandHomePath(selected));
}
function resolveRuntimePaths(config) {
    const dataRoot = configuredDirectory("data_dir", config.data_dir, DEFAULT_DATA_DIRECTORY);
    const databaseDirectory = join(dataRoot, "db");
    return {
        dataRoot,
        databasePath: join(databaseDirectory, "meetings.sqlite3"),
        managedAudioDirectory: join(dataRoot, "meetings"),
    };
}
async function prepareDatabaseDirectory(dataRoot) {
    const databaseDirectory = join(dataRoot, "db");
    await mkdir(databaseDirectory, { recursive: true, mode: 0o700 });
    await chmod(databaseDirectory, 0o700);
}
async function disposeHost(lifetime) {
    try {
        await lifetime.downloads?.dispose();
        await lifetime.okf?.dispose();
        if (lifetime.application === undefined)
            lifetime.repository?.close();
        else
            await lifetime.application.shutdown();
    }
    finally {
        try {
            await lifetime.models?.dispose();
        }
        finally {
            await lifetime.lease[Symbol.asyncDispose]();
        }
    }
}
function logReconciliation(context, result) {
    if (result.orphanedRuns > 0 || result.completedDeletions > 0) {
        context.logger("dsh-asr").info(`startup reconciled orphaned=${result.orphanedRuns} deleted=${result.completedDeletions}`);
    }
    if (result.failedDeletionIds.length > 0) {
        context.logger("dsh-asr").warn(`startup left ${result.failedDeletionIds.length} deletion(s) for retry`);
    }
    if (result.recoveredRecordingIds.length > 0) {
        context.logger("dsh-asr").info(`startup recovered ${result.recoveredRecordingIds.length} recording source(s)`);
    }
    if (result.failedRecordingRecoveryIds.length > 0) {
        context.logger("dsh-asr").warn(`startup left ${result.failedRecordingRecoveryIds.length} recording source(s) for retry`);
    }
}
function createWorkerRunner(context, kind, fingerprint, paths, runtimeAssets, models) {
    const spawner = createDshWorkerSpawner(context.subprocess);
    return {
        async run(run, options) {
            await models?.releaseIdle();
            const assets = await runtimeAssets();
            const worker = new WorkerClient({
                kind,
                expectedFingerprint: fingerprint,
                spawner,
                launch: createPackagedWorkerLaunch({
                    kind,
                    ...(assets.processing === undefined ? {} : { processing: assets.processing }),
                    modelRoot: assets.modelRoot,
                    packagedNativeRoot: assets.packagedNativeRoot,
                    manifestPath: assets.manifestPath,
                    managedAudioDirectory: paths.managedAudioDirectory,
                    graceMs: WORKER_TERMINATION_GRACE_MS,
                }),
                readyTimeoutMs: WORKER_READY_TIMEOUT_MS,
                runDeadlineMs: workerRunDeadlineMs(run.payload.duration_ms),
                terminationTimeoutMs: WORKER_TERMINATION_TIMEOUT_MS,
            });
            return worker.run(run, options);
        },
    };
}
function runtimeAssetsResolver(dataRoot) {
    let pending;
    return () => {
        pending ??= resolveRuntimeAssets({ dataRoot, packageRoot: PACKAGE_ROOT }).catch((error) => {
            pending = undefined;
            throw error;
        });
        return pending;
    };
}
function selectedEngine(context) {
    return readVolatile(effectiveConfig(context).asr_engine) ?? "paraformer";
}
function createRuntimePreparer(context, paths, models) {
    return async (signal, purpose = "batch") => {
        const assets = await resolveConfiguredRuntimeAssets({
            dataRoot: paths.dataRoot, packageRoot: PACKAGE_ROOT, engine: selectedEngine(context),
            ...(signal === undefined ? {} : { signal }),
        });
        const runtimeAssets = async () => assets;
        const fingerprint = assets.engineFingerprint;
        if (purpose === "recording")
            await models.prepare(assets, signal);
        else
            await models.releaseIdle();
        return {
            asr: createWorkerRunner(context, "asr", fingerprint, paths, runtimeAssets, models),
            diarization: createWorkerRunner(context, "diarization", fingerprint, paths, runtimeAssets, models),
            engineFingerprint: fingerprint, processingIdentity: assets.processing.identity,
            recordingWorker: models.factory(assets),
        };
    };
}
export async function apply(context, config) {
    refreshSettingsOnActivation(context);
    const paths = resolveRuntimePaths(config);
    const lifetime = {
        downloads: undefined,
        okf: undefined,
        models: undefined,
        application: undefined,
        lease: await acquireDataRootLease(paths.dataRoot),
        repository: undefined,
    };
    try {
        await prepareDatabaseDirectory(paths.dataRoot);
        const fingerprint = await fingerprintAssetManifest(MANIFEST_PATH);
        const runtimeAssets = runtimeAssetsResolver(paths.dataRoot);
        const audioStore = await openManagedAudioStore({
            dataRoot: paths.dataRoot,
            subprocess: context.subprocess,
        });
        const stored = openMeetingRepository(paths.databasePath);
        lifetime.repository = stored;
        const okfSettings = () => {
            const current = effectiveConfig(context);
            return {
                directory: readVolatile(current.okf_directory) ?? "",
                ingest: readVolatile(current.okf_ingest) ?? true,
            };
        };
        const okf = installOkfHost(context, {
            databasePath: paths.databasePath,
            repository: stored,
            settings: okfSettings,
            meeting: (meetingId) => {
                const meeting = stored.getMeeting(meetingId);
                if (meeting === null || meeting === undefined)
                    return null;
                return { meetingId: meeting.meetingId, title: meeting.title };
            },
        });
        lifetime.okf = okf;
        // Both import and retranscription commit through this repository, so the
        // application receives the hooked one and drafts never trigger ingestion.
        const repository = okf.repository;
        const recording = createProductRecordingFactories({
            expectedFingerprint: fingerprint,
            inspectHelperSignature: createDshRecordingHelperSignatureInspector(context.subprocess),
            packageRoot: PACKAGE_ROOT,
            runtimeAssets,
            subprocess: context.subprocess,
            devices: () => {
                const current = effectiveConfig(context);
                return {
                    mic: readVolatile(current.mic_device_uid) ?? "",
                    system: readVolatile(current.system_device_uid) ?? "",
                };
            },
        });
        const models = new RecordingModelWorker({ spawner: createDshWorkerSpawner(context.subprocess),
            meetingsRoot: paths.managedAudioDirectory, workRoot: join(paths.dataRoot, "work") });
        lifetime.models = models;
        const application = new MeetingApplication({
            prepareRuntime: createRuntimePreparer(context, paths, models),
            asr: createWorkerRunner(context, "asr", fingerprint, paths, runtimeAssets),
            audioStore,
            dataRoot: paths.dataRoot,
            diarization: createWorkerRunner(context, "diarization", fingerprint, paths, runtimeAssets),
            engineFingerprint: fingerprint,
            jobs: context.jobs,
            recording,
            repository,
        });
        lifetime.application = application;
        registerConfigUpdates(context, next => resolveRuntimePaths(next).dataRoot !== paths.dataRoot);
        context.effect(() => () => disposeHost(lifetime), "dsh-asr: application lifecycle");
        const reconciliation = await application.reconcileStartup();
        logReconciliation(context, reconciliation);
        registerMeetingTools(context, application, {
            okfIngestionFor: (meetingId) => {
                const record = okf.service.state(meetingId);
                if (record === undefined)
                    return null;
                return {
                    state: record.state,
                    transcriptVersion: record.transcriptVersion,
                    attempt: record.attempt,
                    finishedAt: record.finishedAtMs === undefined ? null : new Date(record.finishedAtMs).toISOString(),
                    errorCode: record.errorCode ?? null,
                };
            },
        });
        registerOkfTools(context, { pages: okf.pages });
        const downloads = new ModelDownloadController({ dataRoot: paths.dataRoot, packageRoot: PACKAGE_ROOT,
            jobs: context.jobs, transport: context.subprocess, settings: () => {
                const current = effectiveConfig(context);
                const proxyUrl = readVolatile(current.hf_proxy_url) ?? "";
                return { route: readVolatile(current.hf_download_route) ?? "default",
                    proxyUrl,
                    proxyKind: readVolatile(current.hf_proxy_kind) ??
                        (proxyUrl.trim() ? "http" : "mirror") };
            } });
        lifetime.downloads = downloads;
        const directoryPicker = createMacDirectoryPicker({ subprocess: context.subprocess });
        const transcripts = createTranscriptExportControl({
            directory: () => readVolatile(effectiveConfig(context).transcript_directory) ?? "",
            meeting: application,
            picker: directoryPicker,
            pickerPrompt: () => "Choose a folder for exported transcripts",
        });
        const chooseOkfDirectory = (signal) => directoryPicker.choose({
            prompt: "Choose a folder for the Open knowledge base",
            ...(signal === undefined ? {} : { signal }),
        });
        // DSH 0.2.3 resolves the credential verifier through the fiber that calls
        // `connection.admit`, so the call has to come from a context that injected
        // `connection.authentication`. 0.2.2 has no such service, never runs the
        // nested inject, and keeps admitting through the connection it always used.
        const ingestion = lifetime.okf === undefined ? undefined : panelIngestion(lifetime.okf.service);
        const panelPorts = lifetime.okf === undefined || ingestion === undefined ? undefined : {
            meetings: createStoredMeetingPanel({
                meetings: repository,
                ingestion: lifetime.okf.attempts,
                speakerNames: lifetime.okf.speakerNames,
            }),
            ingestion,
            // The folder is what the user can see, so Syncing it removes the stored
            // meetings it does not hold — the same deletion the delete tool performs.
            sync: async (apply) => {
                const reconciliation = createStoredMeetingSync({
                    repository,
                    remove: async (meetingId, expectedVersion) => {
                        await application.deleteMeeting({ meetingId, expectedVersion });
                    },
                    directory: () => okfSettings().directory,
                });
                return apply ? reconciliation.run() : reconciliation.preview();
            },
        };
        let authenticated;
        context.inject(["connection", "connection.authentication"], (authContext) => {
            authenticated = authContext;
            return () => { if (authenticated === authContext)
                authenticated = undefined; };
        });
        context.inject(["connection", "webServer"], (webContext) => {
            const connection = recordingHttpConnection(admittingThrough(() => authenticated?.connection, webContext.connection), webContext.get("webServer"));
            webContext.jobs.attachController("dsh-asr-recording-web");
            const removeRpc = registerRecordingHostRpc(connection, application, signal => readModelSettings({ dataRoot: paths.dataRoot, packageRoot: PACKAGE_ROOT, engine: selectedEngine(context), signal }), downloads, recording.permissions, signal => application.prepareRecording(signal), transcripts, recording.devices, chooseOkfDirectory, lifetime.okf?.speakerNames, panelPorts);
            webContext.effect(() => removeRpc, "dsh-asr: recording client RPC");
        });
    }
    catch (error) {
        await disposeHost(lifetime);
        throw error;
    }
}
//# sourceMappingURL=index.js.map