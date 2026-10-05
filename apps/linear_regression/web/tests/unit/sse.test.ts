import { afterEach, describe, expect, it, vi } from "vitest";
import { streamRun, type StreamHandlers } from "../../src/graph-replay/sse";

function handlers() {
  const calls: string[] = [];
  const h: StreamHandlers = {
    onOpen: () => calls.push("open"),
    onRefused: (info) => calls.push(`refused:${info.status}:${info.reason}:${info.message}:${info.retryAfterSeconds ?? ""}`),
    onStep: (e) => calls.push(`step:${e.node}`),
    onDone: () => calls.push("done"),
    onError: (m) => calls.push(`error:${m}`),
    onDisconnect: () => calls.push("disconnect"),
  };
  return { calls, h };
}

const stream = (text: string) => new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("streamRun", () => {
  it("opens, then reports steps and done, for an accepted start", async () => {
    vi.stubGlobal("fetch", async () => stream(
      'event: step\ndata: {"step":1,"node":"load_data","summary":"s","changes":{}}\n\nevent: done\ndata: {"steps":1}\n\n'));
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["open", "step:load_data", "done"]);
  });

  it("a refused start with a JSON message calls onRefused and nothing else", async () => {
    vi.stubGlobal("fetch", async () => json(429, { reason: "hourly_limit", message: "Try again in about 12 minutes.", retry_after_seconds: 720 }));
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["refused:429:hourly_limit:Try again in about 12 minutes.:720"]);
  });

  it("a bad model choice is reported with its reason", async () => {
    vi.stubGlobal("fetch", async () => json(400, { reason: "model_not_allowed", message: "That model is no longer available." }));
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["refused:400:model_not_allowed:That model is no longer available.:"]);
  });

  it("an error page that is not a refusal is a lost connection", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>Bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["disconnect"]);
  });

  it("a JSON error without a message is a lost connection, not a refusal", async () => {
    vi.stubGlobal("fetch", async () => json(500, { detail: 12 }));
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["disconnect"]);
  });

  it("a network failure is a lost connection", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("network down"); });
    const { calls, h } = handlers();
    await streamRun("/api/run", new AbortController().signal, h);
    expect(calls).toEqual(["disconnect"]);
  });

  it("an aborted run is neither a refusal nor a lost connection", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", async () => { controller.abort(); throw new DOMException("aborted", "AbortError"); });
    const { calls, h } = handlers();
    await streamRun("/api/run", controller.signal, h);
    expect(calls).toEqual([]);
  });
});
