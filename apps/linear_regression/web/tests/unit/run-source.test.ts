import { describe, expect, it } from "vitest";
import type { StepEvent } from "../../src/graph-replay/buffer";
import { dayText } from "../../src/page/recorded";
import { currentRun, failed, initialSource, originLine, received, refused, runLabel, startLive, type RunInfo } from "../../src/page/run-source";

const ev = (step: number, node: string, changes: Record<string, unknown> = {}): StepEvent => ({ step, node, summary: node, changes });
const recorded: RunInfo = { kind: "recorded", modelName: "Fast", recordedOn: "2026-10-22", events: [ev(1, "load_data"), ev(2, "final_test", { final: { r: 1 } })], state: { final: { r: 1 } } };
const liveEvents = [ev(1, "load_data", { model_name: "Thorough" }), ev(2, "final_test", { final: { r: 2 } })];

describe("which run the page shows", () => {
  it("is the recorded run to begin with", () => {
    expect(currentRun(initialSource(recorded))).toBe(recorded);
    expect(currentRun(initialSource(null))).toBeNull();
  });

  it("keeps the recorded run while a live run streams, until its final test has arrived", () => {
    let s = startLive(initialSource(recorded), "Thorough");
    s = received(s, liveEvents.slice(0, 1), { model_name: "Thorough" });
    expect(currentRun(s)).toBe(recorded);
    s = received(s, liveEvents, { model_name: "Thorough", final: { r: 2 } });
    expect(currentRun(s)).toMatchObject({ kind: "live", modelName: "Thorough", events: liveEvents });
    expect(s.pending).toBeNull();
  });

  it("uses the run's own model name once it has one, else the one chosen", () => {
    let s = received(startLive(initialSource(recorded), "Chosen"), liveEvents, { final: {} });
    expect(currentRun(s)?.modelName).toBe("Chosen");
    s = received(startLive(initialSource(recorded), "Chosen"), liveEvents, { model_name: "Reported", final: {} });
    expect(currentRun(s)?.modelName).toBe("Reported");
  });

  it("ignores steps that arrive when no live run is pending", () => {
    const s = initialSource(recorded);
    expect(received(s, liveEvents, { final: { r: 2 } })).toBe(s);
  });

  it("a refused start changes nothing", () => {
    const s = refused(startLive(initialSource(recorded), "X"));
    expect(currentRun(s)).toBe(recorded);
    expect(s.pending).toBeNull();
  });

  it("a live run that fails before its final test leaves the recorded run, and the replay goes back to it", () => {
    const out = failed(received(startLive(initialSource(recorded), "X"), liveEvents.slice(0, 1), {}));
    expect(currentRun(out.state)).toBe(recorded);
    expect(out.show).toBe(recorded.events);
    expect(out.state.pending).toBeNull();
  });

  it("a live run that fails after its final test keeps the live run", () => {
    const switched = received(startLive(initialSource(recorded), "X"), liveEvents, { final: {} });
    const out = failed(switched);
    expect(currentRun(out.state)?.kind).toBe("live");
    expect(out.show).toBe(liveEvents);
  });

  it("a second live run keeps showing the first until its own final test arrives", () => {
    const first = received(startLive(initialSource(recorded), "A"), liveEvents, { final: {} });
    const second = startLive(first, "B");
    expect(currentRun(second)).toBe(first.live);
    const next = received(second, liveEvents, { model_name: "B", final: {} });
    expect(currentRun(next)?.modelName).toBe("B");
  });

  it("nothing to go back to when there is no recording and the live run fails", () => {
    expect(failed(startLive(initialSource(null), "X")).show).toBeNull();
  });
});

describe("the labels", () => {
  it("name the recorded run by day and model, and a live run by its model", () => {
    expect(runLabel(recorded, dayText)).toBe("Recorded 22 October 2026 · Fast");
    const live = currentRun(received(startLive(initialSource(recorded), "T"), liveEvents, { model_name: "Thorough", final: {} }));
    expect(runLabel(live, dayText)).toBe("Your live run · Thorough");
    expect(runLabel(null, dayText)).toBe("");
  });

  it("word the line under the Scoreboard card for each", () => {
    expect(originLine(recorded, dayText)).toBe("From a recorded run on 22 October 2026 with Fast. Run it live to see your own.");
    const live = currentRun(received(startLive(initialSource(recorded), "T"), liveEvents, { model_name: "Thorough", final: {} }));
    expect(originLine(live, dayText)).toBe("From your live run with Thorough.");
  });

  it("dayText leaves anything that is not an ISO date alone", () => {
    expect(dayText("2026-13-01")).toBe("2026-13-01");
    expect(dayText("soon")).toBe("soon");
  });
});
