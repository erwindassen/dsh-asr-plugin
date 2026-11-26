import { describe, expect, it } from "vitest";

import { OkfError } from "../../src/okf/contracts.js";
import { panelIngestion } from "../../src/okf/panel-ingestion.js";
import type { OkfIngestionOutcome, OkfIngestionService } from "../../src/okf/ingestion-service.js";
import type { OkfIngestionRecord } from "../../src/okf/contracts.js";

const MEETING_ID = "a4f7e766-928b-4a96-87d7-f81921fddd1c";

interface FakeService {
  readonly service: OkfIngestionService;
  readonly starts: Array<{ meetingId: string; force: boolean }>;
  record: OkfIngestionRecord | undefined;
  outcome: OkfIngestionOutcome;
  failure: unknown;
}

function fakeService(overrides: Partial<FakeService> = {}): FakeService {
  const starts: Array<{ meetingId: string; force: boolean }> = [];
  const state: FakeService = {
    starts,
    record: undefined,
    outcome: { kind: "started", meetingId: MEETING_ID, jobId: "7", message: "Ingestion started" },
    failure: undefined,
    service: undefined as unknown as OkfIngestionService,
    ...overrides,
  };
  const service = {
    start: (request: { meetingId: string; force?: boolean }) => {
      starts.push({ meetingId: request.meetingId, force: request.force === true });
      if (state.failure !== undefined) throw state.failure;
      return state.outcome;
    },
    state: () => state.record,
    whenIdle: async () => undefined,
    shutdown: async () => undefined,
    recoverStartup: async () => undefined,
    run: async () => state.outcome,
  } as unknown as OkfIngestionService;
  (state as { service: OkfIngestionService }).service = service;
  return state;
}

function record(overrides: Partial<OkfIngestionRecord> = {}): OkfIngestionRecord {
  return {
    meetingId: MEETING_ID,
    transcriptVersion: 2,
    directory: "/bundle",
    state: "running",
    attempt: 1,
    startedAtMs: 1,
    ...overrides,
  };
}

describe("panelIngestion", () => {
  it("reports a started job as running with its job id", async () => {
    const test = fakeService();
    const value = await panelIngestion(test.service).start(MEETING_ID, { force: false });
    expect(value).toEqual({
      job_id: "7",
      state: "running",
      transcript_version: null,
      error_code: null,
      message: null,
    });
    expect(test.starts).toEqual([{ meetingId: MEETING_ID, force: false }]);
  });

  it("passes the force flag through", async () => {
    const test = fakeService();
    await panelIngestion(test.service).start(MEETING_ID, { force: true });
    expect(test.starts[0]?.force).toBe(true);
  });

  it("keeps polling as running before the attempt row exists", async () => {
    const test = fakeService();
    const ingestion = panelIngestion(test.service);
    await ingestion.start(MEETING_ID, { force: false });
    expect(ingestion.status(MEETING_ID).state).toBe("running");
    test.record = record();
    expect(ingestion.status(MEETING_ID).state).toBe("running");
    expect(ingestion.status(MEETING_ID).transcript_version).toBe(2);
  });

  it("reports a terminal success and stops reporting running", async () => {
    const test = fakeService();
    const ingestion = panelIngestion(test.service);
    await ingestion.start(MEETING_ID, { force: false });
    test.record = record({ state: "succeeded", finishedAtMs: 5 });
    const value = ingestion.status(MEETING_ID);
    expect(value).toMatchObject({ state: "succeeded", transcript_version: 2, error_code: null });
    test.record = undefined;
    expect(ingestion.status(MEETING_ID).state).toBe("idle");
  });

  it("reports a terminal failure with its code and the step that failed", async () => {
    const test = fakeService();
    const ingestion = panelIngestion(test.service);
    await ingestion.start(MEETING_ID, { force: false });
    test.record = record({
      state: "failed",
      errorCode: "OKF_AGENT_FAILED",
      errorMessage: "The Open knowledge base writer could not start. Error: unknown model route",
    });
    const value = ingestion.status(MEETING_ID);
    expect(value).toMatchObject({ state: "failed", error_code: "OKF_AGENT_FAILED" });
    expect(value.message).toBe("The Open knowledge base writer could not start. Error: unknown model route");
  });

  it("maps a synchronous refusal to a short message", async () => {
    const test = fakeService({ failure: new OkfError("OKF_NOT_CONFIGURED", "no folder at /secret") });
    const value = await panelIngestion(test.service).start(MEETING_ID, { force: false });
    expect(value).toMatchObject({ state: "failed", job_id: null });
    expect(value.message).toBe("Choose an Open knowledge base folder in settings first.");
    expect(value.error_code).toBe("OKF_NOT_CONFIGURED");
    expect(JSON.stringify(value)).not.toContain("/secret");
  });

  it("reports an already-ingested meeting as succeeded", async () => {
    const test = fakeService({
      outcome: { kind: "ingested", meetingId: MEETING_ID, jobId: null, message: "Already ingested" },
      record: record({ state: "succeeded", finishedAtMs: 9 }),
    });
    const value = await panelIngestion(test.service).start(MEETING_ID, { force: false });
    expect(value).toMatchObject({ state: "succeeded", transcript_version: 2 });
  });

  it("is idle for a meeting that was never ingested", () => {
    const test = fakeService();
    expect(panelIngestion(test.service).status(MEETING_ID).state).toBe("idle");
  });
});
