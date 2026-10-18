import { describe, expect, it } from "vitest";
import { raceText } from "../../src/page/found/race";
import { endLabels, PLOT, xPlace, yPlace, yRange } from "../../src/page/found/race-layout";
import { buildView } from "../../src/page/found/view";
import { afterGrid, beforeGrid, failedFirst, noLlm } from "./found-fixtures";

describe("yRange", () => {
  it("covers every value, with gridlines at whole runs", () => {
    const r = yRange([19.1, 19.6, 20.4, 21.6]);
    expect(r.min).toBeLessThanOrEqual(19.1);
    expect(r.max).toBeGreaterThanOrEqual(21.6);
    expect(r.ticks.every((t) => Number.isInteger(t))).toBe(true);
    expect(r.ticks[0]).toBe(r.min);
    expect(r.ticks[r.ticks.length - 1]).toBe(r.max);
  });
  it("still has a range when every value is equal or there is one value", () => {
    for (const values of [[20, 20, 20], [20.4]]) {
      const r = yRange(values);
      expect(r.max).toBeGreaterThan(r.min);
      expect(r.min).toBeLessThan(values[0]);
      expect(r.max).toBeGreaterThan(values[0]);
    }
  });
  it("thins the gridlines when the span is wide", () => {
    expect(yRange([1, 60]).ticks.length).toBeLessThanOrEqual(7);
  });
  it("places lower values lower on the chart's y axis (larger y is lower down)", () => {
    const r = yRange([19, 22]);
    expect(yPlace(r, r.min)).toBe(PLOT.bottom);
    expect(yPlace(r, r.max)).toBe(PLOT.top);
  });
});

describe("xPlace", () => {
  it("spreads the rounds evenly inside the plot", () => {
    const xs = [1, 2, 3].map((i) => xPlace(i, 3));
    expect(xs[0]).toBeGreaterThan(PLOT.left);
    expect(xs[2]).toBeLessThan(PLOT.right);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1]);
  });
});

describe("endLabels", () => {
  it("keeps labels at least the gap apart even when the lines are close", () => {
    const placed = endLabels([{ id: "ai", y: 100 }, { id: "rival", y: 101 }, { id: "tv", y: 102 }]);
    const ys = Object.values(placed).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(PLOT.gap);
  });
});

describe("raceText", () => {
  it("states every round's outcome and score, the rival's best and the TV's", () => {
    const text = raceText(buildView(afterGrid()));
    expect(text).toContain("Round 1: 20.4 runs, the first score.");
    expect(text).toContain("Round 2: 19.6 runs, a new best.");
    expect(text).toContain("Round 3: rejected by code.");
    expect(text).toContain("Round 4: 19.9 runs, no better.");
    expect(text).toContain("Round 5: the AI said it was finished.");
    expect(text).toContain("The rival's best was 19.7.");
    expect(text).toContain("The TV projection's was 21.6.");
  });
  it("leaves the rival out before the grid search", () => {
    expect(raceText(buildView(beforeGrid()))).not.toContain("rival");
  });
  it("says the AI made no proposals in the fallback", () => {
    expect(raceText(buildView(noLlm()))).toContain("The AI made no proposals");
  });
  it("lists a failed first round instead", () => {
    expect(raceText(buildView(failedFirst()))).toContain("Round 1: the AI failed.");
  });
});
