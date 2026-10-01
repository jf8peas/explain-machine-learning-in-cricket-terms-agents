import { describe, expect, it } from "vitest";
import { predict, projection, validate, type Model } from "../../src/page/predict";

const model: Model = {
  features: ["runs_at_10", "wickets_at_10"],
  coefficients: { runs_at_10: 1.5, wickets_at_10: -6 },
  intercept: 30,
};

describe("predict", () => {
  it("is intercept plus coefficient times value for fitted features", () => {
    expect(predict(model, { runs_at_10: 80, wickets_at_10: 2, powerplay_runs: 45 })).toBeCloseTo(30 + 120 - 12);
  });

  it("ignores features that are not in the final model", () => {
    const a = predict(model, { runs_at_10: 80, wickets_at_10: 2, powerplay_runs: 10 });
    const b = predict(model, { runs_at_10: 80, wickets_at_10: 2, powerplay_runs: 70 });
    expect(a).toBe(b);
  });

  it("works for a runs-only model", () => {
    const m: Model = { features: ["runs_at_10"], coefficients: { runs_at_10: 2 }, intercept: 0 };
    expect(predict(m, { runs_at_10: 50, wickets_at_10: 9, powerplay_runs: 0 })).toBe(100);
  });
});

describe("projection", () => {
  it("is run rate times twenty overs", () => {
    expect(projection(70)).toBe(140);
    expect(projection(0)).toBe(0);
  });
});

describe("validate", () => {
  const ok = { runs_at_10: 80, wickets_at_10: 2, powerplay_runs: 45 };
  it("accepts a valid innings", () => expect(validate(ok)).toEqual([]));
  it("rejects negatives", () => {
    expect(validate({ ...ok, runs_at_10: -1 }).join()).toMatch(/negative/);
    expect(validate({ ...ok, wickets_at_10: -1 }).join()).toMatch(/negative/);
    expect(validate({ ...ok, powerplay_runs: -5 }).join()).toMatch(/negative/);
  });
  it("rejects wickets outside 0-9", () => expect(validate({ ...ok, wickets_at_10: 10 }).join()).toMatch(/between 0 and 9/));
  it("accepts 0 and 9 wickets", () => {
    expect(validate({ ...ok, wickets_at_10: 0 })).toEqual([]);
    expect(validate({ ...ok, wickets_at_10: 9 })).toEqual([]);
  });
  it("rejects powerplay runs above runs at 10 overs", () =>
    expect(validate({ ...ok, runs_at_10: 40, powerplay_runs: 41 }).join()).toMatch(/Powerplay/));
  it("rejects missing or fractional values", () => {
    expect(validate({ runs_at_10: 80, wickets_at_10: 2 }).join()).toMatch(/enter a number/);
    expect(validate({ ...ok, runs_at_10: 80.5 }).join()).toMatch(/whole number/);
  });
});
