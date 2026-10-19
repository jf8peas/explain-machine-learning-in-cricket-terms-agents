import { describe, expect, it } from "vitest";
import { bars, driversText, writerLabel } from "../../src/page/final/takeaways";
import type { DriverRow } from "../../src/page/final/types";

const row = (feature: string, effect: number, label = feature): DriverRow =>
  ({ feature, label, fact_id: `effect_${feature}`, effect_runs: effect, display: Math.abs(effect).toFixed(1) });

describe("bars", () => {
  it("sorts the biggest effect first and keeps every bar", () => {
    const out = bars([row("a", 5), row("b", -30), row("c", 12)]);
    expect(out.map((b) => b.feature)).toEqual(["b", "c", "a"]);
  });

  it("extends runs added to the right of the middle and runs cost to the left, with a sign in the label", () => {
    const [cost, add] = bars([row("cost", -20), row("add", 10)]);
    expect(cost.sign).toBe("costs");
    expect(cost.signed).toBe("−20.0");
    expect(cost.leftPct + cost.widthPct).toBeCloseTo(50);              // ends at the zero line
    expect(add.sign).toBe("adds");
    expect(add.signed).toBe("+10.0");
    expect(add.leftPct).toBeCloseTo(50);
  });

  it("uses the whole track when every effect has the same sign", () => {
    const [only] = bars([row("a", 8)]);
    expect(only.leftPct).toBe(0);
    expect(only.widthPct).toBeCloseTo(100);
    const [negative] = bars([row("a", -8)]);
    expect(negative.leftPct + negative.widthPct).toBeCloseTo(100);
  });

  it("reads correctly with one feature", () => {
    expect(bars([row("only", 24)])).toHaveLength(1);
    expect(driversText([row("only", 24, "runs at the halfway mark")])).toEqual(["runs at the halfway mark: adds 24.0 runs"]);
  });

  it("keeps the smallest bar visible when effects are very unequal", () => {
    const out = bars([row("big", 500), row("tiny", 0.1)]);
    expect(out[1].feature).toBe("tiny");
    expect(out[1].widthPct).toBeGreaterThanOrEqual(2.5);
  });

  it("copes with every effect being zero", () => {
    expect(bars([row("a", 0)])[0].widthPct).toBeGreaterThan(0);
  });

  it("puts the wicket cost on the left and the run rate on the right for a typical model", () => {
    const [runs, wickets] = bars([row("wickets_at_10", -7.0, "wickets lost"), row("runs_at_10", 28.8, "runs at 10 overs")]);
    expect(runs.feature).toBe("runs_at_10");
    expect(runs.leftPct).toBeGreaterThanOrEqual(50);
    expect(wickets.feature).toBe("wickets_at_10");
    expect(wickets.leftPct + wickets.widthPct).toBeLessThanOrEqual(50.0001);
  });
});

describe("the text equivalent", () => {
  it("lists every value with its direction, biggest first", () => {
    expect(driversText([row("a", -4, "wickets"), row("b", 9, "runs")])).toEqual(["runs: adds 9.0 runs", "wickets: costs 4.0 runs"]);
  });
});

describe("the writer label", () => {
  it("names the model when the language model wrote the words", () => {
    expect(writerLabel({ source: "language model", model: "Fast" })).toBe("Written by Fast · every number from code");
  });

  it("says template wording otherwise", () => {
    expect(writerLabel({ source: "template", model: null })).toBe("Template wording · every number from code");
  });
});
