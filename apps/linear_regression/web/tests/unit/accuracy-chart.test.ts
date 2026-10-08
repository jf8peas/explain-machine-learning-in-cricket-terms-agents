import { describe, expect, it } from "vitest";
import {
  axisRange, defaultSelection, markerFor, niceTicks, selectionAfterToggle, shownMethods, type ChartPoints,
} from "../../src/page/accuracy-chart";

const DEFS = [
  { id: "know_nothing", name: "the know-nothing guess", note: "", marker: "square" },
  { id: "broadcaster", name: "the TV projection", note: "", marker: "circle" },
  { id: "llm", name: "the language model's model", note: "", marker: "triangle" },
  { id: "forward", name: "forward selection's model", note: "", marker: "diamond" },
];

const points: ChartPoints = {
  actual: [112, 148, 203, 171],
  predicted: { know_nothing: [155, 155, 155, 155], broadcaster: [120.4, 140, 190.6, 150], llm: [118, 150, 200, 169], forward: [117, 151, 198, 170] },
};

describe("axisRange", () => {
  it("covers every point of every method and the actual totals, with round ends", () => {
    const r = axisRange(points);
    const all = [...points.actual, ...Object.values(points.predicted).flat()];
    expect(r.min).toBeLessThanOrEqual(Math.min(...all));
    expect(r.max).toBeGreaterThanOrEqual(Math.max(...all));
    expect(r.min % r.step).toBeCloseTo(0, 9);
    expect(r.max % r.step).toBeCloseTo(0, 9);
  });

  it("is worked out from all the methods, so a method with the widest guesses sets the range", () => {
    const wide: ChartPoints = { ...points, predicted: { ...points.predicted, broadcaster: [60, 140, 260, 150] } };
    const all = axisRange(wide), onlyLlm = axisRange({ actual: wide.actual, predicted: { llm: wide.predicted.llm } });
    expect(all.min).toBeLessThanOrEqual(60);
    expect(all.max).toBeGreaterThanOrEqual(260);
    expect(onlyLlm.max).toBeLessThan(260);                      // which is why the chart is always given all of them
  });

  it("copes with a single value and with equal values", () => {
    const r = axisRange({ actual: [150], predicted: { a: [150] } });
    expect(r.max).toBeGreaterThan(r.min);
    expect(r.min).toBeLessThanOrEqual(150);
    expect(r.max).toBeGreaterThanOrEqual(150);
  });
});

describe("niceTicks", () => {
  it("returns round values, all inside the range, from its start to its end", () => {
    const r = axisRange(points);
    const ticks = niceTicks(r);
    expect(ticks[0]).toBe(r.min);
    expect(ticks[ticks.length - 1]).toBe(r.max);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(r.min);
      expect(t).toBeLessThanOrEqual(r.max);
      expect(Math.abs(t / r.step - Math.round(t / r.step))).toBeLessThan(1e-9);
    }
  });

  it("uses a step of 1, 2, 2.5 or 5 times a power of ten, and a handful of ticks", () => {
    for (const spread of [[100, 130], [100, 300], [0, 1], [90, 1000]]) {
      const r = axisRange({ actual: spread, predicted: { a: spread } });
      const mantissa = r.step / 10 ** Math.floor(Math.log10(r.step));
      expect([1, 2, 2.5, 5].some((m) => Math.abs(m - mantissa) < 1e-9)).toBe(true);
      const count = niceTicks(r).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(12);
    }
  });
});

describe("markers", () => {
  it("gives each of the four methods its own shape, taken from its definition", () => {
    const shapes = DEFS.map((d) => markerFor(d));
    expect(shapes).toEqual(["square", "circle", "triangle", "diamond"]);
    expect(new Set(shapes).size).toBe(4);
  });

  it("falls back to a circle for an unknown shape", () => {
    expect(markerFor({ id: "x", name: "x", note: "", marker: "star" })).toBe("circle");
  });
});

describe("selection", () => {
  const all = ["know_nothing", "broadcaster", "llm", "forward"];

  it("starts with the winning model and the TV projection, in display order", () => {
    expect(defaultSelection(all, "llm")).toEqual(["broadcaster", "llm"]);
    expect(defaultSelection(all, "forward")).toEqual(["broadcaster", "forward"]);
  });

  it("is the winner and the projection when the language model did not take part", () => {
    expect(defaultSelection(["know_nothing", "broadcaster", "forward"], "forward")).toEqual(["broadcaster", "forward"]);
  });

  it("toggling adds a method, and toggling it again removes it, keeping display order", () => {
    let sel = defaultSelection(all, "forward");
    sel = selectionAfterToggle(sel, "know_nothing", all);
    expect(sel).toEqual(["know_nothing", "broadcaster", "forward"]);
    sel = selectionAfterToggle(sel, "broadcaster", all);
    expect(sel).toEqual(["know_nothing", "forward"]);
  });

  it("can be emptied, and then there is nothing to draw but a prompt", () => {
    let sel = ["broadcaster"];
    sel = selectionAfterToggle(sel, "broadcaster", all);
    expect(sel).toEqual([]);
    expect(shownMethods(sel, points)).toEqual([]);
  });

  it("ignores a method that is not on offer (the language model's, when it did not take part)", () => {
    const offered = ["know_nothing", "broadcaster", "forward"];
    expect(selectionAfterToggle(["broadcaster"], "llm", offered)).toEqual(["broadcaster"]);
    expect(shownMethods(["llm", "broadcaster"], { actual: [1], predicted: { broadcaster: [1] } })).toEqual(["broadcaster"]);
  });
});
