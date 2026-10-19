import { describe, expect, it } from "vitest";
import { closingText, shares } from "../../src/page/final/closeness";
import { rows } from "../../src/page/final/view";
import { finalState, ordinary, type Fig } from "./final-fixtures";

describe("shares", () => {
  it("split the displayed figures into within 10, 10 to 20 and more than 20", () => {
    expect(shares(33.6, 65.4)).toEqual([34, 31, 35]);
    expect(shares(22.0, 44.2)).toEqual([22, 22, 56]);
  });

  it("always add to 100, whatever the figures (every pair on a one-decimal grid with within 20 at least within 10)", () => {
    for (let w10 = 0; w10 <= 100; w10 += 0.5) {
      for (let w20 = w10; w20 <= 100; w20 += 0.5) {
        const [a, b, c] = shares(w10, w20);
        expect(a + b + c).toBe(100);
        expect(Math.min(a, b, c)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("add to 100 at the edges", () => {
    expect(shares(0, 0)).toEqual([0, 0, 100]);
    expect(shares(100, 100)).toEqual([100, 0, 0]);
    expect(shares(40, 40)).toEqual([40, 0, 60]);
    expect(shares(0, 100)).toEqual([0, 100, 0]);
  });

  it("use the displayed figures, rounding .5 up like the page", () => {
    expect(shares(12.5, 40.5)).toEqual([13, 28, 59]);
    expect(shares(12.4, 40.4)).toEqual([12, 28, 60]);
  });

  it("stay valid if the figures arrive slightly out of order or out of range", () => {
    const [a, b, c] = shares(50, 49.6);                  // within 20 below within 10: treated as equal
    expect(a + b + c).toBe(100);
    expect(shares(-3, 140).reduce((x, y) => x + y, 0)).toBe(100);
  });

  it("add to 100 for every method of three differing sets of figures", () => {
    const sets: Record<string, Fig>[] = [
      ordinary,
      { ...ordinary, forward: { average_miss: 9.0, within_10: 61.3, within_20: 90.1, bias: 0.0 } },
      { know_nothing: { average_miss: 40.0, within_10: 5.4, within_20: 12.8, bias: 3.0 }, broadcaster: { average_miss: 35.0, within_10: 8.0, within_20: 20.0, bias: 20.0 },
        forward: { average_miss: 30.0, within_10: 12.2, within_20: 31.9, bias: -4.0 } },
    ];
    for (const figs of sets) {
      for (const r of rows(finalState(figs))) expect(shares(r.within10, r.within20).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});

describe("the layout without the AI model", () => {
  it("has three rows in section 1's order", () => {
    const { llm: _llm, ...without } = ordinary;
    const r = rows(finalState(without, "forward"));
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.id)).toEqual(["forward", "broadcaster", "know_nothing"]);
  });

  it("carries each row's bias phrase as the server sent it", () => {
    const r = rows(finalState(ordinary));
    expect(r.find((x) => x.id === "broadcaster")!.phrase).toBe("guesses 12.2 runs too low on average");
    expect(r.find((x) => x.id === "know_nothing")!.phrase).toBe("guesses about right on average");
  });
});

describe("the closing line", () => {
  it("names our pick's share in words and the within-10 threshold from the facts", () => {
    const t = closingText("only about a third of the time", "10");
    expect(t).toContain("Even our pick was within 10 runs of the real total only about a third of the time.");
    expect(t).toContain("No method can be perfect from the halfway mark");
  });

  it("drops the 'Even' when the share is high", () => {
    expect(closingText("about two thirds of the time", "10")).toContain("Our pick was within 10 runs of the real total about two thirds of the time.");
  });

  it("falls back to the note alone without the facts", () => {
    expect(closingText(undefined, undefined)).toMatch(/^No method can be perfect/);
  });
});
