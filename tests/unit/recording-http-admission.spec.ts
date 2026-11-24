import { describe, expect, it, vi } from "vitest";

import {
  admittingThrough,
  recordingHttpConnection,
  type RecordingRpcAdmission,
  type RecordingWebServer,
} from "../../src/recording/http-connection.js";
import { RECORDING_RPC_ENDPOINTS } from "../../src/recording/rpc-contract.js";

function connection(rejection?: 401 | 403 | 503): RecordingRpcAdmission & { admit: ReturnType<typeof vi.fn> } {
  const admit = vi.fn(() => rejection === undefined
    ? { peer: { owner: true } } as const
    : { rejection } as const);
  return { admit } as RecordingRpcAdmission & { admit: ReturnType<typeof vi.fn> };
}

const request = { headers: {}, method: "POST", url: "/api/dsh-asr-recording/state" } as never;

describe("recording route admission", () => {
  it("admits through the fallback connection while no authenticated context exists", () => {
    const fallback = connection();
    const admission = admittingThrough(() => undefined, fallback);
    expect(admission.admit(request)).toEqual({ peer: { owner: true } });
    expect(fallback.admit).toHaveBeenCalledTimes(1);
  });

  it("prefers the authenticated connection once its context is available", () => {
    const fallback = connection(403);
    const authenticated = connection();
    const preferred: RecordingRpcAdmission | undefined = authenticated;
    const admission = admittingThrough(() => preferred, fallback);
    expect(admission.admit(request)).toEqual({ peer: { owner: true } });
    expect(authenticated.admit).toHaveBeenCalledTimes(1);
    expect(fallback.admit).not.toHaveBeenCalled();
  });

  it("re-reads the preference so a later injection takes effect and a disposal falls back", () => {
    const fallback = connection(403);
    const authenticated = connection();
    let preferred: RecordingRpcAdmission | undefined;
    const admission = admittingThrough(() => preferred, fallback);

    expect(admission.admit(request)).toEqual({ rejection: 403 });
    preferred = authenticated;
    expect(admission.admit(request)).toEqual({ peer: { owner: true } });
    preferred = undefined;
    expect(admission.admit(request)).toEqual({ rejection: 403 });
    expect(fallback.admit).toHaveBeenCalledTimes(2);
    expect(authenticated.admit).toHaveBeenCalledTimes(1);
  });

  it("registers one exact route per endpoint", () => {
    const routes: Parameters<RecordingWebServer["register"]>[0][] = [];
    const webServer: RecordingWebServer = { register: route => { routes.push(route); return () => {}; } };

    recordingHttpConnection(connection(), webServer).rpc.handle(
      "/dsh-asr-recording",
      async () => ({ ok: true, value: "" }),
      { authority: "loopback" },
    );

    expect(routes.map(route => route.path)).toEqual(
      RECORDING_RPC_ENDPOINTS.map(endpoint => `/api/dsh-asr-recording/${endpoint}`),
    );
  });
});
