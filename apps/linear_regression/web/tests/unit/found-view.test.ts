import { describe, expect, it } from "vitest";
import { buildView, SHADE_STEPS } from "../../src/page/found/view";
import { afterGrid, allRejected, beforeGrid, failedFirst, forwardAttempt, makeGrid, noLlm } from "./found-fixtures";

describe("rounds joined to attempts", () => {
  const view = buildView(beforeGrid());
  it("gives each fitted round the score and result of the attempt with its round number", () => {
    expect(view.rounds.map((r) => [r.round, r.kind, r.miss])).toEqual([[1, "fitted", 204], [2, "fitted", 196], [3, "rejected", null], [4, "fitted", 199], [5, "finished", null]]);
    expect(view.rounds.map((r) => r.improved)).toEqual([true, true, false, false, false]);
  });
  it("marks the first score, the drop from the displayed values and the best round", () => {
    expect(view.rounds[0].firstScore).toBe(true);
    expect(view.rounds[0].drop).toBeNull();
    expect(view.rounds[1].drop).toBe(8);           // 20.4 to 19.6, not 20.44 to 19.56
    expect(view.rounds.map((r) => r.isBest)).toEqual([false, true, false, false, false]);
  });
  it("keeps the rejected message and the reason as they came", () => {
    expect(view.rounds[2].message).toBe("wickets in hand repeats wickets lost");
    expect(view.rounds[4].reason).toBe("that is enough");
  });
  it("reads a failed round as failed, with its message", () => {
    const v = buildView({ ...beforeGrid(), rounds: [{ round: 1, features: [], reason: "", finished: false, outcome: "failed", message: "timed out" }] });
    expect(v.rounds[0]).toMatchObject({ kind: "failed", message: "timed out" });
  });
});

describe("the clue wording", () => {
  const view = buildView(beforeGrid());
  it("compares with the previous fitted round: first, added, rejected-as-changed, same", () => {
    expect(view.rounds.map((r) => r.change)).toEqual(["first", "added", "added", "same", "changed"]);
    expect(view.rounds[1].added).toEqual(["sixes"]);
    expect(view.rounds[2].added).toEqual(["wickets_in_hand"]);   // compared with round 2, the last fitted round
  });
});

describe("best so far and the rival line", () => {
  it("takes the step line from the improved attempts only", () => {
    expect(buildView(beforeGrid()).bestSoFar).toEqual([{ round: 1, miss: 204 }, { round: 2, miss: 196 }]);
    expect(buildView(beforeGrid()).aiBest).toBe(196);
  });
  it("shows the rival and the grid only once the grid search is on display", () => {
    const before = buildView(beforeGrid());
    expect(before.rival).toBeNull();
    expect(before.groups).toEqual([]);
    expect(before.ranking.every((r) => r.foundBy === "ai")).toBe(true);
    const after = buildView(afterGrid());
    expect(after.rival).toBe(197);
    expect(after.groups).toHaveLength(2);
  });
  it("takes the TV from the baseline", () => {
    expect(buildView(beforeGrid()).tv).toBe(216);
  });
});

describe("the choice", () => {
  it("is pending until the decision is in the state", () => {
    expect(buildView(beforeGrid()).choice.state).toBe("pending");
  });
  it("names the AI and works the gap out from the displayed values; a gap under the threshold is a whisker", () => {
    const c = buildView(afterGrid("llm", 19.74)).choice;     // AI 19.6 shown, rival 19.7 shown
    expect(c).toMatchObject({ state: "whisker", chosen: "ai", chosenMiss: 196, otherMiss: 197, gap: 1, tooClose: true });
  });
  it("names the rival when it is recorded as chosen", () => {
    expect(buildView(afterGrid("forward", 19.2)).choice).toMatchObject({ chosen: "rival", chosenMiss: 192, otherMiss: 196, gap: 4, state: "whisker" });
  });
  it("is a clear choice once the gap reaches the threshold", () => {
    expect(buildView(afterGrid("llm", 20.7)).choice).toMatchObject({ state: "clear", chosen: "ai", gap: 11, tooClose: false });
    expect(buildView(afterGrid("forward", 19.1)).choice).toMatchObject({ state: "clear", chosen: "rival", gap: 5, tooClose: false });
  });
  it("treats equal displayed misses as a whisker with the AI chosen", () => {
    expect(buildView(afterGrid("llm", 19.56)).choice).toMatchObject({ state: "whisker", chosen: "ai", gap: 0 });
  });
  it("does not override a recorded rival choice when the displayed values are equal", () => {
    expect(buildView(afterGrid("forward", 19.56)).choice).toMatchObject({ state: "whisker", chosen: "rival", gap: 0 });
  });
});

describe("the fallback and runs with no fitted AI attempt", () => {
  it("is the fallback when the model was not used and made no attempts", () => {
    const v = buildView(noLlm());
    expect(v.fallback).toBe(true);
    expect(v.choice.state).toBe("noAi");
    expect(v.bestSoFar).toEqual([]);
    expect(v.ranking.every((r) => r.foundBy === "rival")).toBe(true);
  });
  it("is also the fallback when the model failed in round 1, with the failed round still listed", () => {
    const v = buildView(failedFirst());
    expect(v.fallback).toBe(true);
    expect(v.rounds.map((r) => r.kind)).toEqual(["failed"]);
  });
  it("is not the fallback when every proposal was rejected, but there is no AI line and the rival is named", () => {
    const v = buildView({ ...allRejected(), grid: makeGrid(), forward_best: forwardAttempt(), validation_winner: { winner: "llm" } });
    expect(v.fallback).toBe(false);
    expect(v.bestSoFar).toEqual([]);
    expect(v.aiBest).toBeNull();
    expect(v.choice.state).toBe("noAi");
    expect(v.rounds.map((r) => r.kind)).toEqual(["rejected", "finished"]);
  });
});

describe("the ranking", () => {
  const view = buildView(afterGrid());
  it("lists the AI's attempts and the allowed grid cells, not the rival's own attempt", () => {
    expect(view.ranking).toHaveLength(3 + 23);                                   // 3 AI attempts, 24 cells less one not allowed
    expect(view.ranking.filter((r) => r.foundBy === "rival")).toHaveLength(23);
  });
  it("sorts by average miss, with numbered ranks", () => {
    const misses = view.ranking.map((r) => r.miss);
    expect([...misses].sort((a, b) => a - b)).toEqual(misses);
    expect(view.ranking.map((r) => r.rank)).toEqual(view.ranking.map((_, i) => i + 1));
  });
  it("puts the AI's try first when it ties with a grid cell", () => {
    const state = afterGrid();
    (state.attempts as { validation_mae: number }[])[0].validation_mae = 19.4;   // ties the grid's first cell (19.7 here: use equal)
    const grid = makeGrid(19.4);
    const v = buildView({ ...state, grid });
    const tied = v.ranking.filter((r) => r.miss === 194);
    expect(tied.map((r) => r.foundBy)).toEqual(["ai", "rival"]);
  });
});

describe("the grid", () => {
  const view = buildView(afterGrid());
  it("makes one group per training-innings choice with rows and columns in the cells' order", () => {
    expect(view.groups.map((g) => g.innings)).toEqual(["population", "all"]);
    expect(view.groups[0].windows).toEqual(["all", "last_10", "last_5", "last_3"]);
    expect(view.groups[0].weightings).toEqual(["none", "gentle", "strong"]);
  });
  it("prints a value in every allowed cell and a dash with its note in the others", () => {
    const cells = view.groups.flatMap((g) => g.cells);
    expect(cells).toHaveLength(24);
    expect(cells.filter((c) => !c.allowed).map((c) => [c.text, c.note, c.step])).toEqual([["–", "too few innings", null]]);
    expect(cells.filter((c) => c.allowed).every((c) => /^\d+\.\d$/.test(c.text))).toBe(true);
  });
  it("shades smaller misses darker (lower step) and flags exactly the best cell", () => {
    const cells = view.groups.flatMap((g) => g.cells).filter((c) => c.allowed);
    const sorted = [...cells].sort((a, b) => parseFloat(a.text) - parseFloat(b.text));
    expect(sorted[0].step).toBe(0);
    expect(sorted[sorted.length - 1].step).toBe(SHADE_STEPS - 1);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].step).toBeGreaterThanOrEqual(sorted[i - 1].step as number);
    expect(view.groups.flatMap((g) => g.cells).filter((c) => c.best)).toHaveLength(1);
  });
  it("gives cells with equal values the same step", () => {
    const grid = makeGrid();
    grid.cells.forEach((c) => { if (c.allowed) c.validation_mae = 20; });
    const v = buildView({ ...afterGrid(), grid });
    expect(new Set(v.groups.flatMap((g) => g.cells).filter((c) => c.allowed).map((c) => c.step)).size).toBe(1);
  });
});

describe("the tab fills in step by step", () => {
  it("shows only what has happened so far at each step, and nothing later when stepping back", () => {
    const full = afterGrid() as Record<string, unknown>;
    const early = { ...full, rounds: (full.rounds as unknown[]).slice(0, 1), attempts: (full.attempts as unknown[]).slice(0, 1), grid: undefined, forward_best: undefined, validation_winner: undefined };
    const a = buildView(early);
    expect(a.rounds).toHaveLength(1);
    expect(a.rival).toBeNull();
    expect(a.groups).toEqual([]);
    expect(a.choice.state).toBe("pending");
    const b = buildView(full);
    expect(b.rounds).toHaveLength(5);
    expect(b.rival).not.toBeNull();
    expect(buildView(early)).toEqual(a);        // stepping back gives the earlier view again
  });
});
