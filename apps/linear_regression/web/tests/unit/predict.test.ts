import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { featureValues, fieldsFor, predict, projection, validate, type Catalogue, type Model } from "../../src/page/predict";

const catalogue: Catalogue = {
  limit: 8,
  features: JSON.parse(readFileSync("tests/fixtures/recipe_cases.json", "utf8")).catalogue,
  competition: { column: "competition", reference: "t20i", options: [
    { value: "t20i", label: "T20 International" }, { value: "ipl", label: "IPL" }, { value: "bbl", label: "BBL" }] },
};

describe("the form's inputs for a winning feature set", () => {
  it("asks for runs at 10 overs first, then only the base measurements the features need", () => {
    const fields = fieldsFor(["wickets_in_hand", "fours_at_10"], catalogue);
    expect(fields.map((f) => f.id)).toEqual(["runs_at_10", "wickets_at_10", "fours_at_10"]);
  });

  it("does not ask for derived values", () => {
    const ids = fieldsFor(["runs_x_wickets_in_hand", "wickets_in_hand"], catalogue).map((f) => f.id);
    expect(ids).toEqual(["runs_at_10", "wickets_at_10"]);
    expect(ids).not.toContain("wickets_in_hand");
  });

  it("offers competition as a choice (reference first) when a dummy is in the model", () => {
    const fields = fieldsFor(["runs_at_10", "is_ipl"], catalogue);
    const comp = fields.find((f) => f.id === "competition")!;
    expect(comp.kind).toBe("choice");
    expect(comp.kind === "choice" && comp.options.map((o) => o.value)).toEqual(["t20i", "ipl", "bbl"]);
    expect(fieldsFor(["runs_at_10"], catalogue).some((f) => f.id === "competition")).toBe(false);
  });

  it("takes bounds from the catalogue", () => {
    const wickets = fieldsFor(["wickets_at_10"], catalogue).find((f) => f.id === "wickets_at_10")!;
    expect(wickets.kind === "number" && [wickets.min, wickets.max]).toEqual([0, 9]);
  });
});

describe("validate", () => {
  const fields = fieldsFor(["wickets_at_10", "powerplay_runs", "is_bbl"], catalogue);
  const ok = { runs_at_10: 80, wickets_at_10: 2, powerplay_runs: 45, competition: "ipl" };

  it("accepts good input", () => {
    expect(validate(ok, fields)).toEqual([]);
  });
  it("says what is wrong, in words", () => {
    expect(validate({ ...ok, runs_at_10: -5 }, fields).join(" ")).toContain("cannot be negative");
    expect(validate({ ...ok, wickets_at_10: 10 }, fields).join(" ")).toContain("between 0 and 9");
    expect(validate({ ...ok, runs_at_10: undefined }, fields).join(" ")).toContain("enter a number");
    expect(validate({ ...ok, runs_at_10: 3.5 }, fields).join(" ")).toContain("whole number");
    expect(validate({ ...ok, competition: "" }, fields).join(" ")).toContain("choose one");
  });
  it("powerplay runs cannot exceed the runs at 10 overs", () => {
    expect(validate({ ...ok, runs_at_10: 40, powerplay_runs: 50 }, fields).join(" ")).toContain("Powerplay runs cannot be more");
  });
});

describe("predict", () => {
  const model: Model = {
    features: ["runs_at_10", "wickets_in_hand", "is_ipl"],
    coefficients: { runs_at_10: 1.5, wickets_in_hand: 4, is_ipl: 10 },
    intercept: 30,
  };

  it("works out derived values and the dummies from what was entered", () => {
    const values = featureValues({ runs_at_10: 80, wickets_at_10: 2, competition: "ipl" }, catalogue);
    expect(values.wickets_in_hand).toBe(8);
    expect(values.is_ipl).toBe(1);
    expect(predict(model, values)).toBeCloseTo(30 + 120 + 32 + 10);
  });

  it("a T20 international sets both dummies to zero", () => {
    const v = featureValues({ runs_at_10: 70, wickets_at_10: 3, competition: "t20i" }, catalogue);
    expect([v.is_ipl, v.is_bbl]).toEqual([0, 0]);
  });

  it("ignores features that are not in the model", () => {
    const m: Model = { features: ["runs_at_10"], coefficients: { runs_at_10: 2 }, intercept: 0 };
    const a = predict(m, featureValues({ runs_at_10: 50, wickets_at_10: 9, competition: "ipl" }, catalogue));
    const b = predict(m, featureValues({ runs_at_10: 50, wickets_at_10: 0, competition: "bbl" }, catalogue));
    expect(a).toBe(100);
    expect(a).toBe(b);
  });
});

describe("projection", () => {
  it("is run rate times twenty overs", () => {
    expect(projection(70)).toBe(140);
    expect(projection(0)).toBe(0);
  });
});
