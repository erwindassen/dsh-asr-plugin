import { expect, it, vi } from "vitest";

import type { MeetingApplication } from "../../src/application/meeting-application.js";
import {
  registerRecordingHostRpc,
  type RecordingRpcConnection,
} from "../../src/recording/host-rpc.js";
import { RECORDING_RPC_CHANNEL } from "../../src/recording/rpc-contract.js";

it("只在 loopback UI channel 注册录音与 Meeting reference 四个 endpoint", async () => {
  let handler: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1] | undefined;
  const remove = vi.fn(async () => undefined);
  const connection: RecordingRpcConnection = {
    rpc: {
      handle: vi.fn((_channel, value) => {
        handler = value;
        return remove;
      }),
    },
  };
  const state = { meetingId: "meeting-1", phase: "recording" };
  const application = {
    getRecordingState: vi.fn(() => state),
    hasRecordingHistory: vi.fn(() => true),
    getRecordingPreview: vi.fn(() => [{ seq: 1, text: "最近草稿" }]),
    controlRecording: vi.fn(async (input) => ({ action: input.action })),
    getMeetingReferenceCandidates: vi.fn(() => [{
      meetingId: "11111111-1111-4111-8111-111111111111",
      label: "产品周会",
      origin: "recording",
      phase: "recording",
      startedAtMs: null,
      createdAtMs: 1_788_220_800_000,
      recordingElapsedMs: null,
      durationMs: null,
    }]),
    resolveMeetingReference: vi.fn(() => ({
      meetingId: "11111111-1111-4111-8111-111111111111",
      label: "产品周会",
      origin: "recording",
      phase: "recording",
      startedAtMs: null,
      createdAtMs: 1_788_220_800_000,
      recordingElapsedMs: null,
      durationMs: null,
    })),
    getMeetingLivePage: vi.fn((input) => ({ meetingId: input.meetingId })),
  } as unknown as MeetingApplication;

  expect(registerRecordingHostRpc(connection, application)).toBe(remove);
  expect(connection.rpc.handle).toHaveBeenCalledWith(
    RECORDING_RPC_CHANNEL,
    expect.any(Function),
    { authority: "loopback" },
  );
  if (handler === undefined) throw new Error("RPC handler missing");
  const signal = new AbortController().signal;

  await expect(handler("state", {}, signal)).resolves.toEqual({
    ok: true,
    value: { recording: state, hasRecordingHistory: true, preview: [{ seq: 1, text: "最近草稿" }] },
  });
  await expect(handler("control", { action: "start", title: "周会" }, signal))
    .resolves.toMatchObject({ ok: true, value: { action: "start" } });
  expect(application.controlRecording).toHaveBeenCalledWith({ action: "start", title: "周会", signal });
  await expect(handler("live-page", { meeting_id: "meeting-1", limit: 3 }, signal))
    .resolves.toMatchObject({ ok: false, error: { code: "internal" } });
  expect(application.getMeetingLivePage).not.toHaveBeenCalled();
  await expect(handler("references/candidates", {
    session_id: "session-1",
    locale: "zh-CN",
    query: "产品",
  }, signal)).resolves.toEqual({
    ok: true,
    value: [{
      meeting_id: "11111111-1111-4111-8111-111111111111",
      label: "产品周会",
      origin: "recording",
      phase: "recording",
      started_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      recording_elapsed_ms: null,
      duration_ms: null,
    }],
  });
  expect(application.getMeetingReferenceCandidates).toHaveBeenCalledWith({
    locale: "zh-CN",
    query: "产品",
  });
  await expect(handler("references/resolve", {
    locale: "zh-CN",
    meeting_id: "11111111-1111-4111-8111-111111111111",
  }, signal)).resolves.toMatchObject({
    ok: true,
    value: { meeting_id: "11111111-1111-4111-8111-111111111111", label: "产品周会" },
  });
  expect(application.resolveMeetingReference).toHaveBeenCalledWith({
    locale: "zh-CN",
    meetingId: "11111111-1111-4111-8111-111111111111",
  });

  for (const [endpoint, payload] of [
    ["state", { unexpected: true }],
    ["control", { action: "stop" }],
    ["references/candidates", { session_id: "", locale: "zh-CN" }],
    ["references/resolve", { locale: "zh-CN" }],
    ["unknown", {}],
  ] as const) {
    await expect(handler(endpoint, payload, signal)).resolves.toMatchObject({
      ok: false,
      error: { code: "internal" },
    });
  }
});

it("serves model status only through the existing loopback channel and rejects path overrides", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const status = { mode: "base", engine: "paraformer", preference: null, inheritedLegacy: false, selectedReady: false,
    base: { state: "missing", issues: [] }, parakeet: { state: "missing", issues: [] },
    punctuation: { state: "missing", issues: [] }, native: { state: "ready", issues: [] },
    dataDirectory: "/owned/data" } as const;
  const readStatus = vi.fn(async () => status);
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, {} as MeetingApplication, readStatus);
  const signal = new AbortController().signal;
  expect(await handler("models/status", {}, signal)).toEqual({ ok: true, value: status });
  expect(await handler("models/status", { data_dir: "/other" }, new AbortController().signal)).toMatchObject({ ok: false });
  expect(readStatus).toHaveBeenCalledOnce();
  expect(readStatus).toHaveBeenCalledWith(signal);
});

it("uses fixed pack requests and never accepts download paths, sources or proxy credentials in RPC", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const state = { pack: null, phase: "idle", downloadedBytes: 0, totalBytes: 0, jobId: null, errorCode: null } as const;
  const download = { status: () => state, start: vi.fn(async () => state), cancel: vi.fn(async () => state) };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, {} as MeetingApplication, undefined, download);
  const signal = new AbortController().signal;
  expect(await handler("models/download/status", {}, signal)).toEqual({ ok: true, value: state });
  expect(await handler("models/download/start", { pack: "base" }, signal)).toEqual({ ok: true, value: state });
  expect(download.start).toHaveBeenCalledWith("base");
  expect(await handler("models/download/cancel", {}, signal)).toEqual({ ok: true, value: state });
  for (const payload of [{ pack: "all" }, { pack: "base", url: "https://example.com" },
    { pack: "base", proxyUrl: "http://secret@proxy" }, { pack: "punctuation", data_dir: "/other" }]) {
    expect(await handler("models/download/start", payload, signal)).toMatchObject({ ok: false });
  }
  expect(download.start).toHaveBeenCalledOnce();
});

it("serves permission diagnostics and accepts only the two fixed settings targets", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const permissions = {read: vi.fn(async () => ({microphone:"denied",system:"unverified"} as const)),
    test: vi.fn(async () => ({microphone:"granted",system:"verified"} as const)),
    require: vi.fn(async () => {}), openSettings: vi.fn(async () => {})};
  registerRecordingHostRpc({rpc:{handle:(_channel,value)=>{handler=value;return async()=>{};}}},
    {getRecordingState:()=>null} as unknown as MeetingApplication, undefined, undefined, permissions);
  const signal = new AbortController().signal;
  expect(await handler("permissions/status",{},signal)).toEqual({ok:true,value:{microphone:"denied",system:"unverified"}});
  expect(await handler("permissions/test",{},signal)).toEqual({ok:true,value:{microphone:"granted",system:"verified"}});
  for (const track of ["microphone","system"]) {
    expect(await handler("permissions/open-settings",{track},signal)).toEqual({ok:true,value:null});
  }
  for (const payload of [{track:"other"},{track:"system",url:"file:///private"}]) {
    expect(await handler("permissions/open-settings",payload,signal)).toMatchObject({ok:false});
  }
  expect(permissions.openSettings).toHaveBeenCalledTimes(2);
  expect(await handler("permissions/test",{path:"/other"},signal)).toMatchObject({ok:false});
});

it("does not play a diagnostic tone during an active recording", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const permissions = {read:vi.fn(),test:vi.fn(),require:vi.fn(),openSettings:vi.fn()};
  registerRecordingHostRpc({rpc:{handle:(_channel,value)=>{handler=value;return async()=>{};}}},
    {getRecordingState:()=>({phase:"recording"})} as unknown as MeetingApplication, undefined, undefined, permissions);
  expect(await handler("permissions/test",{},new AbortController().signal)).toMatchObject({
    ok:false,error:{message:"ENGINE_BUSY"},
  });
  expect(permissions.test).not.toHaveBeenCalled();
});

it("exports transcripts and picks folders without accepting destination file paths", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const control = {chooseDirectory: vi.fn(async () => "/Users/erwindassen/Transcripts"),
    exportTranscript: vi.fn(async () => ({bytes: 42, format: "md" as const,
      meetingId: "a4f7e766-928b-4a96-87d7-f81921fddd1c", outputPath: "/Users/erwindassen/Transcripts/call.md",
      segmentCount: 3, transcriptVersion: 1}))};
  registerRecordingHostRpc({rpc:{handle:(_channel,value)=>{handler=value;return async()=>{};}}},
    {getRecordingState:()=>null} as unknown as MeetingApplication, undefined, undefined, undefined, undefined, control);
  const signal = new AbortController().signal;
  expect(await handler("transcripts/choose-directory", {}, signal)).toEqual({ok:true,value:"/Users/erwindassen/Transcripts"});
  const payload = {destination:"default",format:"md",include_speakers:true,include_timestamps:true,
    meeting_id:"a4f7e766-928b-4a96-87d7-f81921fddd1c"};
  expect(await handler("transcripts/export", payload, signal)).toEqual({ok:true,value:{bytes:42,format:"md",
    meeting_id:"a4f7e766-928b-4a96-87d7-f81921fddd1c",output_path:"/Users/erwindassen/Transcripts/call.md",
    segment_count:3,transcript_version:1}});
  expect(control.exportTranscript).toHaveBeenCalledOnce();
  for (const invalid of [{...payload, output_path:"/tmp/injected.md"}, {...payload, format:"docx"},
    {...payload, meeting_id:"not-a-uuid"}, {...payload, directory:"relative/path"}]) {
    expect(await handler("transcripts/export", invalid, signal)).toMatchObject({ok:false});
  }
  expect(control.exportTranscript).toHaveBeenCalledOnce();
});



it("forwards an attribution map to the export control only when one was sent", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const calls: unknown[] = [];
  const control = {
    chooseDirectory: vi.fn(async () => null),
    exportTranscript: vi.fn(async (request: unknown) => { calls.push(request); return { bytes: 1, format: "md" as const,
      meetingId: "a4f7e766-928b-4a96-87d7-f81921fddd1c", outputPath: "/tmp/call.md",
      segmentCount: 1, transcriptVersion: 1 }; }),
  };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, control);
  const signal = new AbortController().signal;
  const payload = { destination: "default", format: "md", include_speakers: true, include_timestamps: true,
    meeting_id: "a4f7e766-928b-4a96-87d7-f81921fddd1c" };
  await handler("transcripts/export", payload, signal);
  expect(calls[0]).not.toHaveProperty("speakerNames");
  await handler("transcripts/export", { ...payload, speaker_names: { "Speaker A": "Erwin" } }, signal);
  expect(calls[1]).toMatchObject({ speakerNames: { "Speaker A": "Erwin" } });
});

it("reads and replaces one meeting's speaker attribution", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const store: { meetingId: string; label: string; name: string }[] = [];
  const speakerNames = {
    list: vi.fn((meetingId: string) => store.filter((row) => row.meetingId === meetingId)),
    replace: vi.fn((meetingId: string, names: readonly { label: string; name: string }[]) => {
      store.splice(0, store.length, ...names.map(({ label, name }) => ({ meetingId, label, name })));
    }),
  };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, speakerNames);
  const signal = new AbortController().signal;
  const meeting = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
  expect(await handler("transcripts/speaker-names", { meeting_id: meeting }, signal)).toEqual({
    ok: true, value: { speaker_names: {} },
  });
  expect(await handler("transcripts/save-speaker-names",
    { meeting_id: meeting, speaker_names: { "Speaker A": "Erwin" } }, signal)).toEqual({
    ok: true, value: { speaker_names: { "Speaker A": "Erwin" } },
  });
  expect(speakerNames.replace).toHaveBeenCalledOnce();
  for (const invalid of [
    { meeting_id: "not-a-uuid" },
    { meeting_id: meeting, speaker_names: { "Speaker A": 7 } },
    { meeting_id: meeting, speaker_names: { "": "Erwin" } },
    { meeting_id: meeting, speaker_names: {}, extra: true },
  ]) {
    expect(await handler("transcripts/save-speaker-names", invalid, signal)).toMatchObject({ ok: false });
  }
  expect(speakerNames.replace).toHaveBeenCalledOnce();
});

it("prepares recording models without accepting paths or recording audio", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const prepare = vi.fn(async () => undefined);
  const app = { getRecordingState: () => null } as unknown as MeetingApplication;
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, app, undefined, undefined, undefined, prepare);
  const signal = new AbortController().signal;
  expect(await handler("models/prepare", {}, signal)).toEqual({ ok: true, value: null });
  expect(await handler("models/prepare", { model_root: "/other" }, signal)).toMatchObject({ ok: false });
  expect(prepare).toHaveBeenCalledExactlyOnceWith(signal);
});

it("lists audio devices without accepting device paths or helper arguments", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const devices = { list: vi.fn(async () => ({
    defaultInputUID: "AppleUSBAudioEngine:Insta360:Insta360 Link 2C:144000:3",
    defaultOutputUID: null,
    devices: [{ uid: "AppleUSBAudioEngine:Insta360:Insta360 Link 2C:144000:3", name: "Insta360 Link 2C",
      inputChannels: 1, outputChannels: 0, defaultInput: true, defaultOutput: false }],
  })) };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, undefined, devices);
  const signal = new AbortController().signal;
  expect(await handler("devices/list", {}, signal)).toEqual({ ok: true, value: {
    default_input_uid: "AppleUSBAudioEngine:Insta360:Insta360 Link 2C:144000:3",
    default_output_uid: null,
    devices: [{ uid: "AppleUSBAudioEngine:Insta360:Insta360 Link 2C:144000:3", name: "Insta360 Link 2C",
      input_channels: 1, output_channels: 0, default_input: true, default_output: false }],
  } });
  expect(devices.list).toHaveBeenCalledExactlyOnceWith(signal);
  for (const payload of [{ uid: "BuiltInMicrophoneDevice" }, { argv: ["__devices"] }]) {
    expect(await handler("devices/list", payload, signal)).toMatchObject({ ok: false });
  }
  expect(devices.list).toHaveBeenCalledOnce();
});

it("serves the committed meeting list and one meeting's transcript snapshot", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const meeting = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
  const other = "b5e8f877-a39c-4ba7-98e8-f92a2feee2d1";
  const entry = {
    meeting_id: meeting,
    title: "产品周会",
    started_at: null,
    duration_ms: 1_000,
    transcript_version: 2,
    status: "partial" as const,
    ingested_transcript_version: 1,
  };
  const transcript = {
    meeting_id: meeting,
    title: "产品周会",
    transcript_version: 2,
    duration_ms: 1_000,
    segments: [{ seq: 1, startMs: 0, endMs: 900, speakerLabel: "Erwin", text: "synthetic" }],
  };
  const meetings = {
    list: vi.fn((_limit: number) => [entry]),
    transcript: vi.fn((meetingId: string) => meetingId === meeting ? transcript : null),
  };
  const ingestion = { start: vi.fn(), status: vi.fn() };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  { meetings, ingestion });
  const signal = new AbortController().signal;

  expect(await handler("meetings/list", {}, signal)).toEqual({ ok: true, value: { items: [entry] } });
  expect(meetings.list).toHaveBeenLastCalledWith(20);
  expect(await handler("meetings/list", { limit: 5 }, signal)).toEqual({ ok: true, value: { items: [entry] } });
  expect(meetings.list).toHaveBeenLastCalledWith(5);
  expect(await handler("meetings/transcript", { meeting_id: meeting }, signal))
    .toEqual({ ok: true, value: transcript });
  expect(meetings.transcript).toHaveBeenCalledExactlyOnceWith(meeting);
  expect(await handler("meetings/transcript", { meeting_id: other }, signal)).toMatchObject({
    ok: false, error: { message: "MEETING_NOT_FOUND" },
  });

  for (const payload of [
    { limit: 0 }, { limit: 51 }, { limit: 2.5 }, { limit: "5" }, { limit: 5, extra: true },
  ]) {
    expect(await handler("meetings/list", payload, signal)).toMatchObject({ ok: false });
  }
  for (const payload of [{}, { meeting_id: "not-a-uuid" }, { meeting_id: meeting, extra: true }]) {
    expect(await handler("meetings/transcript", payload, signal)).toMatchObject({ ok: false });
  }
  expect(meetings.list).toHaveBeenCalledTimes(2);
  expect(meetings.transcript).toHaveBeenCalledTimes(2);
});

it("starts and reports one meeting's OKF ingestion without accepting extra fields", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const meeting = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
  const running = {
    job_id: "job-1", state: "running" as const, transcript_version: 2,
    error_code: null, message: null,
  };
  const ingestion = {
    start: vi.fn(async (_meetingId: string, _options: { readonly force: boolean }) => running),
    status: vi.fn((_meetingId: string) => running),
  };
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  { meetings: { list: vi.fn(), transcript: vi.fn() }, ingestion });
  const signal = new AbortController().signal;

  expect(await handler("okf/ingest", { meeting_id: meeting }, signal)).toEqual({ ok: true, value: running });
  expect(ingestion.start).toHaveBeenLastCalledWith(meeting, { force: false });
  expect(await handler("okf/ingest", { meeting_id: meeting, force: true }, signal))
    .toEqual({ ok: true, value: running });
  expect(ingestion.start).toHaveBeenLastCalledWith(meeting, { force: true });
  expect(await handler("okf/ingest/status", { meeting_id: meeting }, signal))
    .toEqual({ ok: true, value: running });
  expect(ingestion.status).toHaveBeenCalledExactlyOnceWith(meeting);

  for (const payload of [{}, { meeting_id: "not-a-uuid" }, { meeting_id: meeting, force: "yes" },
    { meeting_id: meeting, extra: true }]) {
    expect(await handler("okf/ingest", payload, signal)).toMatchObject({ ok: false });
  }
  expect(ingestion.start).toHaveBeenCalledTimes(2);
  expect(await handler("okf/ingest/status", { meeting_id: meeting, extra: true }, signal))
    .toMatchObject({ ok: false });
});

it("previews and applies one folder reconciliation without accepting extra fields", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  const sync = vi.fn(async (apply: boolean) => ({ removed: apply ? 2 : 2, kept: 3 }));
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  { meetings: { list: vi.fn(), transcript: vi.fn() }, ingestion: { start: vi.fn(), status: vi.fn() }, sync });
  const signal = new AbortController().signal;

  expect(await handler("meetings/sync", {}, signal)).toEqual({ ok: true, value: { removed: 2, kept: 3 } });
  expect(sync).toHaveBeenLastCalledWith(false);
  expect(await handler("meetings/sync", { apply: true }, signal))
    .toEqual({ ok: true, value: { removed: 2, kept: 3 } });
  expect(sync).toHaveBeenLastCalledWith(true);

  for (const payload of [{ apply: "yes" }, { apply: true, extra: true }]) {
    expect(await handler("meetings/sync", payload, signal)).toMatchObject({ ok: false });
  }
  expect(sync).toHaveBeenCalledTimes(2);
});

it("keeps the panel endpoints unknown when no panel ports were wired", async () => {
  let handler!: Parameters<RecordingRpcConnection["rpc"]["handle"]>[1];
  registerRecordingHostRpc({ rpc: { handle: (_channel, value) => {
    handler = value; return async () => {};
  } } }, { getRecordingState: () => null } as unknown as MeetingApplication);
  const signal = new AbortController().signal;
  const meeting = "a4f7e766-928b-4a96-87d7-f81921fddd1c";
  const unknownEndpoint = await handler("unknown", {}, signal);
  expect(unknownEndpoint).toMatchObject({ ok: false, error: { code: "internal" } });
  for (const [endpoint, payload] of [
    ["meetings/list", {}],
    ["meetings/transcript", { meeting_id: meeting }],
    ["okf/ingest", { meeting_id: meeting }],
    ["okf/ingest/status", { meeting_id: meeting }],
    ["meetings/sync", {}],
  ] as const) {
    await expect(handler(endpoint, payload, signal)).resolves.toEqual(unknownEndpoint);
  }
});
