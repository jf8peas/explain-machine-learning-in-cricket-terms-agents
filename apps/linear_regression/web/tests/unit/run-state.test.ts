import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StepEvent } from "../../src/graph-replay/buffer";
import {
  announcement, buttons, failed, finished, initialRunState, lock, press, refused, replayable, resultStrip, rightNow, started,
  statusText, stepped, type RunState,
} from "../../src/page/run-state";

const fixture = JSON.parse(readFileSync("tests/fixtures/fake-run.json", "utf8")) as { model_name: string; events: StepEvent[] };
const EVENTS = fixture.events;
const FINAL_AT = EVENTS.findIndex((e) => e.changes.final);

/** Play a run into the state: press, then start and complete each event up to and including `upTo` (all by default). */
function play(s: RunState, upTo = EVENTS.length - 1, model = "Fast"): RunState {
  let next = press(s, model);
  for (const e of EVENTS.slice(0, upTo + 1)) next = stepped(started(next, e), e);
  return next;
}
const done = (s: RunState) => finished(s);

describe("the run state", () => {
  it("starts idle with nothing kept", () => {
    const s = initialRunState();
    expect(s).toMatchObject({ phase: "idle", current: null, last: null, message: null });
    expect(lock(s)).toEqual({ locked: true, variant: "before" });
    expect(buttons(s)).toEqual({ play: { label: "▶ Play", disabled: false }, watchAgain: false, selectDisabled: false });
    expect(statusText(s, null)).toBe("Ready. Choose the AI and press play.");
  });

  it("pressing Play starts a run: the select and button are disabled, the verdict says it is waiting", () => {
    const s = press(initialRunState(), "Fast");
    expect(s.phase).toBe("running");
    expect(buttons(s)).toEqual({ play: { label: "Running…", disabled: true }, watchAgain: false, selectDisabled: true });
    expect(lock(s)).toEqual({ locked: true, variant: "during" });
    expect(statusText(s, "Code is loading the innings")).toBe("Live with Fast · Code is loading the innings");
  });

  it("ignores a second press while a run is going", () => {
    const first = press(initialRunState(), "Fast");
    expect(press(first, "Other")).toBe(first);
  });

  it("rings the node that started, and clears it when that node's step arrives", () => {
    let s = press(initialRunState(), "Fast");
    s = started(s, EVENTS[0]);
    expect(s.current?.inProgress).toBe("load_data");
    s = stepped(s, EVENTS[0]);
    expect(s.current?.inProgress).toBeNull();
    expect(s.current?.events).toHaveLength(1);
  });

  it("unlocks at the final test and follows the run until it ends", () => {
    const atFinal = play(initialRunState(), FINAL_AT);
    expect(atFinal.phase).toBe("running");
    expect(lock(atFinal)).toEqual({ locked: false, variant: "before" });
    expect(atFinal.last?.state.final).toBeTruthy();
    const end = done(play(initialRunState()));
    expect(end.phase).toBe("finished");
    expect(end.last?.events).toHaveLength(EVENTS.length);              // the explanation steps after the final test are in
    expect(end.last?.state.explanation).toBeTruthy();
  });

  it("stays locked, with the during wording, until the final test arrives", () => {
    const beforeFinal = play(initialRunState(), FINAL_AT - 1);
    expect(lock(beforeFinal)).toEqual({ locked: true, variant: "during" });
    expect(beforeFinal.last).toBeNull();
  });

  it("after a finished run: Run again and Watch it again, and the status reads finished with the tries and the best score", () => {
    const s = done(play(initialRunState()));
    expect(buttons(s)).toEqual({ play: { label: "▶ Run again", disabled: false }, watchAgain: true, selectDisabled: false });
    expect(statusText(s, null)).toMatch(/^Finished with Fast · \d+ tries? · best \d+\.\d on the check seasons$/);
    expect(replayable(s)).toBe(s.last);
  });

  it("keeps the first run's results while a second run goes and when it fails", () => {
    const first = done(play(initialRunState()));
    let second = press(first, "Fast");
    expect(second.last).toBe(first.last);
    expect(lock(second)).toEqual({ locked: false, variant: "before" });
    second = stepped(started(second, EVENTS[0]), EVENTS[0]);
    expect(second.last).toBe(first.last);                                // not replaced before its own final test
    const stopped = failed(second, "The run failed: boom");
    expect(stopped.phase).toBe("failed");
    expect(stopped.last).toBe(first.last);
    expect(lock(stopped).locked).toBe(false);
    expect(buttons(stopped).play.label).toBe("▶ Run again");
    expect(buttons(stopped).watchAgain).toBe(true);
    expect(replayable(stopped)).toBe(first.last);                        // Watch it again replays the earlier finished run
  });

  it("a second run's final test replaces the first's results", () => {
    const first = done(play(initialRunState()));
    const second = play(first, FINAL_AT);
    expect(second.last).not.toBe(first.last);
    expect(second.last?.events).toHaveLength(FINAL_AT + 1);
  });

  it("a failed first run leaves everything locked with the failure wording and the node that was running marked", () => {
    let s = press(initialRunState(), "Fast");
    s = stepped(started(s, EVENTS[0]), EVENTS[0]);
    s = started(s, EVENTS[1]);
    const stopped = failed(s, "The run failed: boom");
    expect(lock(stopped)).toEqual({ locked: true, variant: "failed" });
    expect(stopped.current?.stoppedAt).toBe("split");
    expect(stopped.current?.events).toHaveLength(1);                     // the rounds already received stay
    expect(buttons(stopped)).toEqual({ play: { label: "▶ Play", disabled: false }, watchAgain: false, selectDisabled: false });
    expect(statusText(stopped, null)).toBe("Stopped: The run failed: boom");
    expect(rightNow(stopped, { split: "x" }, 6).stopped).toBe("Stopped: The run failed: boom");
    expect(rightNow(stopped, { split: "Code is splitting" }, 6).step).toBe("split");
  });

  it("a refused start puts everything back and shows the refusal", () => {
    const first = done(play(initialRunState()));
    const refusedState = refused(press(first, "Fast"), "You've used your 5 live runs for this hour.");
    expect(refusedState.phase).toBe("finished");
    expect(refusedState.last).toBe(first.last);
    expect(refusedState.message).toBe("You've used your 5 live runs for this hour.");
    expect(refused(press(initialRunState(), "Fast"), "No").phase).toBe("idle");
    expect(buttons(refused(press(initialRunState(), "Fast"), "No")).selectDisabled).toBe(false);
  });

  it("pressing again clears an earlier message", () => {
    const s = refused(press(initialRunState(), "Fast"), "No");
    expect(press(s, "Fast").message).toBeNull();
  });

  it("the Right now card reads the node, what it is doing, the round and the best score", () => {
    const s = play(initialRunState(), 5);
    const now = rightNow(started(s, EVENTS[6]), { fit_model: "Code fits the regression" }, 6);
    expect(now.step).toBe("fit_model");
    expect(now.doing).toBe("Code fits the regression");
    expect(now.round).toBe("1 of up to 6");
    expect(rightNow(initialRunState(), {}, 6)).toEqual({ step: "—", doing: "—", round: "—", best: "—", stopped: null });
  });

  it("speaks phase changes and AI/code changes, not every node", () => {
    expect(announcement(initialRunState(), null)).toBe("");
    expect(announcement(press(initialRunState(), "Fast"), null)).toBe("The run has started with Fast.");
    expect(announcement(play(initialRunState(), 3), "ai")).toBe("The AI agent is deciding.");
    expect(announcement(play(initialRunState(), 3), "code")).toBe("Code is working.");
    expect(announcement(done(play(initialRunState())), null)).toBe("The run has finished with Fast.");
  });

  it("a run without the agent says so in the status line", () => {
    const s = done(play(initialRunState()));
    const noAgent: RunState = { ...s, current: { ...s.current!, state: { ...s.current!.state, final: { llm_took_part: false } } } };
    expect(statusText(noAgent, null)).toMatch(/^Finished with the brute-force search alone · best /);
  });

  it("gives the result strip from the run whose results are shown", () => {
    expect(resultStrip(initialRunState())).toBeNull();
    const strip = resultStrip(done(play(initialRunState())));
    expect(strip?.label).toBeTruthy();
    expect(strip?.text).toMatch(/runs out, the TV/);
  });

  it("stores nothing", () => {
    const keys: string[] = [];
    const store = { setItem: (k: string) => { keys.push(k); }, getItem: () => null };
    (globalThis as unknown as { localStorage: unknown; sessionStorage: unknown }).localStorage = store;
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = store;
    done(play(initialRunState()));
    expect(keys).toEqual([]);
  });
});
