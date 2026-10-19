import { describe, expect, it } from "vitest";
import { barPercent, scaleMax, ticks } from "../../src/page/final/race";
import { headerLead, rows } from "../../src/page/final/view";
import { finalState, ordinary, type Fig } from "./final-fixtures";

const figs = (misses: [number, number, number, number]): Record<string, Fig> => ({
  know_nothing: { ...ordinary.know_nothing, average_miss: misses[0] }, broadcaster: { ...ordinary.broadcaster, average_miss: misses[1] },
  llm: { ...ordinary.llm, average_miss: misses[2] }, forward: { ...ordinary.forward, average_miss: misses[3] },
});

describe("the scale", () => {
  it("rounds the longest average miss up to the next 10 runs", () => {
    expect(scaleMax([18.6, 30.4, 21.4])).toBe(40);
    expect(scaleMax([5.1])).toBe(10);
    expect(scaleMax([29.9])).toBe(30);
  });

  it("keeps an exact multiple of 10 and copes with all zeros", () => {
    expect(scaleMax([30.0, 12.0])).toBe(30);
    expect(scaleMax([0, 0])).toBe(10);
    expect(scaleMax([])).toBe(10);
  });

  it("labels 0 and every 10 runs up to the end of the scale", () => {
    expect(ticks(40)).toEqual([0, 10, 20, 30, 40]);
    expect(ticks(10)).toEqual([0, 10]);
  });

  it("draws every bar from zero on the same scale", () => {
    expect(barPercent(30.4, 40)).toBeCloseTo(76);
    expect(barPercent(0, 40)).toBe(0);
    expect(barPercent(60, 40)).toBe(100);
  });
});

describe("the rows", () => {
  it("sort by average miss, best first, with place labels 1st to 4th", () => {
    const r = rows(finalState(ordinary));
    expect(r.map((x) => x.id)).toEqual(["forward", "llm", "broadcaster", "know_nothing"]);
    expect(r.map((x) => x.placeLabel)).toEqual(["1st", "2nd", "3rd", "4th"]);
  });

  it("re-sort when the figures change", () => {
    expect(rows(finalState(figs([30.0, 15.0, 18.0, 20.0]))).map((x) => x.id)).toEqual(["broadcaster", "llm", "forward", "know_nothing"]);
    expect(rows(finalState(figs([10.0, 15.0, 18.0, 20.0]))).map((x) => x.id)).toEqual(["know_nothing", "broadcaster", "llm", "forward"]);
  });

  it("keep the order of the methods when two misses are equal", () => {
    expect(rows(finalState(figs([20.0, 20.0, 20.0, 20.0]))).map((x) => x.id)).toEqual(["know_nothing", "broadcaster", "llm", "forward"]);
  });

  it("mark the chosen model, which need not have the shortest bar", () => {
    const r = rows(finalState(ordinary, "llm"));
    expect(r.filter((x) => x.isChosen).map((x) => x.id)).toEqual(["llm"]);
    expect(r[0].id).toBe("forward");
  });

  it("have three rows when the AI model is absent", () => {
    const { llm: _llm, ...without } = ordinary;
    const r = rows(finalState(without, "forward"));
    expect(r.map((x) => x.id)).toEqual(["forward", "broadcaster", "know_nothing"]);
    expect(headerLead(2026, 214, r.length)).toContain("three predictions");
  });

  it("name the header's year and innings from the state", () => {
    expect(headerLead(2026, 214, 4)).toBe(
      "2026: a season nothing learned from or was chosen on. For each of its 214 innings, four predictions of the final total, " +
      "made at the halfway mark and then compared with what really happened.");
    expect(headerLead(2024, 99, 4)).toContain("2024:");
    expect(headerLead(2024, 99, 4)).toContain("99 innings");
  });
});
