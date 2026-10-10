import { describe, expect, it } from "vitest";
import { badgeShape, bars, driversText, orderedBlocks, stripShares, yearText, type DriverRow, type Segment } from "../../src/page/cricket-terms";

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
});

describe("the text equivalents", () => {
  it("list every value with its direction, biggest first", () => {
    expect(driversText([row("a", -4, "wickets"), row("b", 9, "runs")])).toEqual(["runs: adds 9.0 runs", "wickets: costs 4.0 runs"]);
  });

  it("describe each year segment in words", () => {
    const training: Segment = { kind: "training", from: 2005, to: 2022, label: "Training" };
    const check: Segment = { kind: "check", from: 2023, to: 2023, label: "Check" };
    expect(yearText(training)).toBe("Training 2005 to 2022");
    expect(yearText(check)).toBe("Check 2023");
  });
});

describe("the year strip", () => {
  const segments: Segment[] = [
    { kind: "training", from: 2005, to: 2022, label: "Training" }, { kind: "check", from: 2023, to: 2023, label: "Check" },
    { kind: "check", from: 2024, to: 2024, label: "Check" }, { kind: "check", from: 2025, to: 2025, label: "Check" },
    { kind: "test", from: 2026, to: 2026, label: "Test" },
  ];

  it("gives shares that add up to one and never make a segment too narrow to read", () => {
    const shares = stripShares(segments);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.min(...shares)).toBeGreaterThan(0.05);
    expect(shares[0]).toBeGreaterThan(shares[1]);                     // the training years are the widest
  });
});

describe("the badge and the order", () => {
  it("uses a different shape for a goal reached and a goal missed, not only a different colour", () => {
    expect(badgeShape(true)).toBe("tick");
    expect(badgeShape(false)).toBe("cross");
  });

  it("shows the blocks in the order given, then any block the order left out", () => {
    const blocks = ["verdict", "drivers", "wicket", "closing"].map((id) => ({ id, title: id, sentences: [], visual: {} }));
    expect(orderedBlocks({ blocks, order: ["verdict", "wicket", "drivers", "closing"] }).map((b) => b.id)).toEqual(["verdict", "wicket", "drivers", "closing"]);
    expect(orderedBlocks({ blocks, order: ["closing", "verdict", "bonus"] }).map((b) => b.id)).toEqual(["closing", "verdict", "drivers", "wicket"]);
  });
});
