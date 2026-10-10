import { describe, expect, it } from "vitest";
import { hasModel, initial, step, type Detail, type Readiness } from "../../src/page/readiness";

const attempt = { features: ["runs_at_10"], proposer: "llm", validation_mae: 20, validation_r2: 0.5, improved: true, round: 1 };
const modelState = { coefficients: { runs_at_10: 1 }, intercept: 5, final: { x: 1 }, explanation: { sentences: [] } };

const detail = (over: Partial<Detail> & { state?: Record<string, unknown> } = {}): Detail => ({
  run: 1, steps: 5, atEnd: false, failed: false, state: {}, finalState: null, ...over,
});
/** Feed a sequence of details through the machine, returning every action in order and the last state. */
function feed(details: Detail[], active = "working", from: Readiness = initial) {
  let state = from;
  const actions = [];
  for (const d of details) {
    const out = step(state, d, active);
    state = out.state;
    actions.push(...out.actions);
  }
  return { state, actions };
}
const switches = (actions: ReturnType<typeof feed>["actions"]) => actions.filter((a) => a.type === "switch");

describe("the switch to What the agent found", () => {
  it("happens exactly once, when playback reaches the end", () => {
    const { actions } = feed([detail({ atEnd: false }), detail({ atEnd: true, state: { final: {} } })]);
    expect(switches(actions)).toEqual([{ type: "switch", tab: "found", focus: true }]);
  });

  it("does not happen before the end, and waits through a pause", () => {
    const { actions } = feed([detail(), detail({ steps: 20 }), detail({ steps: 20 })]);
    expect(switches(actions)).toHaveLength(0);
    const then = feed([detail({ atEnd: true })], "working", feed([detail(), detail()]).state);
    expect(switches(then.actions)).toHaveLength(1);
  });

  it("does not happen again after stepping back and forward, or jumping, in the same run", () => {
    const at = feed([detail({ atEnd: true })]);
    const again = feed([detail({ atEnd: false }), detail({ atEnd: true }), detail({ atEnd: false }), detail({ atEnd: true })], "found", at.state);
    expect(switches(again.actions)).toHaveLength(0);
  });

  it("does not happen when the run failed (an error or a lost connection)", () => {
    expect(switches(feed([detail({ atEnd: true, failed: true })]).actions)).toHaveLength(0);
  });

  it("does not happen when the data could not be loaded", () => {
    expect(switches(feed([detail({ atEnd: true, state: { data_error: "no data" } })]).actions)).toHaveLength(0);
  });

  it("does not happen with no steps on display", () => {
    expect(switches(feed([detail({ atEnd: true, steps: 0 })]).actions)).toHaveLength(0);
  });

  it("happens whichever tab the visitor is on, including Data", () => {
    for (const tab of ["working", "data", "final-test", "try-your-own"]) {
      expect(switches(feed([detail({ atEnd: true })], tab).actions)).toHaveLength(1);
    }
  });

  it("happens again for the next run, and the new run leaves the current tab alone", () => {
    const first = feed([detail({ atEnd: true })]);
    const second = feed([detail({ run: 2 }), detail({ run: 2, atEnd: true })], "final-test", first.state);
    expect(switches(second.actions)).toHaveLength(1);
    expect(second.actions.slice(0, 6).every((a) => a.type !== "switch")).toBe(true);
  });
});

describe("readiness of the result tabs", () => {
  it("makes What the agent found ready from the first attempt or reasoning round", () => {
    expect(feed([detail({ state: {} })]).state.ready.found).toBe(false);
    expect(feed([detail({ state: { attempts: [attempt] } })]).state.ready.found).toBe(true);
    expect(feed([detail({ state: { rounds: [{ round: 1 }] } })]).state.ready.found).toBe(true);
  });

  it("makes The final test ready when the final state is on display, and not before", () => {
    expect(feed([detail({ state: { attempts: [attempt] } })]).state.ready.final).toBe(false);
    expect(feed([detail({ state: { attempts: [attempt], final: { x: 1 } } })]).state.ready.final).toBe(true);
  });

  it("makes Try your own innings ready once the finished run holds a model", () => {
    expect(feed([detail({ finalState: null })]).state.ready.tryit).toBe(false);
    expect(feed([detail({ finalState: modelState })]).state.ready.tryit).toBe(true);
    expect(hasModel({ coefficients: {} })).toBe(false);
  });

  it("shows the not-ready sentence again when the display steps back before the content", () => {
    const up = feed([detail({ state: { final: {} } })]);
    const back = step(up.state, detail({ state: {} }), "working");
    expect(back.actions).toContainEqual({ type: "notReady", tab: "final-test", show: true });
    expect(back.state.ready.final).toBe(false);
  });

  it("returns every result tab to not ready on a new run, clearing their markers", () => {
    const first = feed([detail({ state: { attempts: [attempt], final: {} } })]);
    const out = step(first.state, detail({ run: 2 }), "working");
    for (const tab of ["found", "final-test", "try-your-own"]) {
      expect(out.actions).toContainEqual({ type: "notReady", tab, show: true });
      expect(out.actions).toContainEqual({ type: "marker", tab, on: false });
    }
    expect(out.state.run).toBe(2);
    expect(out.state.switched).toBe(false);
  });
});

describe("markers", () => {
  it("are set when a tab becomes ready and is not the one showing", () => {
    const out = step(initial, detail({ state: { attempts: [attempt] } }), "working");
    expect(out.actions).toContainEqual({ type: "marker", tab: "found", on: true });
  });

  it("are not set for the tab the visitor is already on", () => {
    const out = step(initial, detail({ state: { attempts: [attempt] } }), "found");
    expect(out.actions.some((a) => a.type === "marker" && a.tab === "found" && a.on)).toBe(false);
  });

  it("are announced once per run, so stepping back and forward does not set them again", () => {
    const a = feed([detail({ state: { attempts: [attempt] } })]);
    const b = feed([detail({ state: {} }), detail({ state: { attempts: [attempt] } })], "working", a.state);
    expect(b.actions.some((x) => x.type === "marker" && x.on)).toBe(false);
  });

  it("are not set for the tab the visitor is taken to at the end", () => {
    const out = step(initial, detail({ atEnd: true, state: { attempts: [attempt], final: {} } }), "working");
    expect(out.actions).toContainEqual({ type: "marker", tab: "found", on: false });
    expect(out.actions).toContainEqual({ type: "marker", tab: "final-test", on: true });
  });
});
