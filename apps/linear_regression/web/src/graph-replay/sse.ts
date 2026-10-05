// SSE reader built on fetch() and a stream reader. EventSource is deliberately not used:
// it reconnects automatically on a drop, which would silently rerun the agent.
import type { StepEvent } from "./buffer";

/** A start the server refused (for example a rate limit): it sent a JSON body instead of a stream. */
export interface Refusal {
  status: number;
  reason: string;
  message: string;
  retryAfterSeconds?: number;
}

export interface StreamHandlers {
  /** The server accepted the start and the stream is about to begin. */
  onOpen(): void;
  /** The server refused the start. Nothing was run, so nothing already on screen should be disturbed. */
  onRefused(info: Refusal): void;
  onStep(e: StepEvent): void;
  onDone(info: { steps: number }): void;
  /** The server reported a failure through an `error` event. */
  onError(message: string): void;
  /** The connection ended or failed before `done`. */
  onDisconnect(): void;
}

export function parseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

/** A refusal body is JSON with a message. Anything else (a gateway error page) is treated as a lost connection. */
async function readRefusal(res: Response): Promise<Refusal | null> {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    const body = (await res.json()) as { reason?: string; message?: string; retry_after_seconds?: number };
    if (typeof body.message !== "string") return null;
    return { status: res.status, reason: body.reason ?? "refused", message: body.message, retryAfterSeconds: body.retry_after_seconds };
  } catch {
    return null;
  }
}

export async function streamRun(url: string, signal: AbortSignal, h: StreamHandlers): Promise<void> {
  let ended = false; // done or error received
  try {
    const res = await fetch(url, { signal, headers: { Accept: "text/event-stream" }, cache: "no-store" });
    if (!res.ok) {
      const refusal = await readRefusal(res);
      if (refusal) {
        ended = true;
        h.onRefused(refusal);
        return;
      }
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    h.onOpen();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const msg = parseBlock(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (!msg) continue;
        if (msg.event === "step") h.onStep(msg.data as StepEvent);
        else if (msg.event === "done") { ended = true; h.onDone(msg.data as { steps: number }); }
        else if (msg.event === "error") { ended = true; h.onError((msg.data as { message: string }).message); }
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return; // Play again / Reset: not a failure
  }
  if (!ended && !signal.aborted) h.onDisconnect();
}
