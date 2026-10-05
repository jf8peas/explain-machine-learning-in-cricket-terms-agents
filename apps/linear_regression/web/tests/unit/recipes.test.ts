// The browser's recipe interpreter must give exactly what the backend's gives, on a fixture the backend wrote
// (tests/test_recipe_fixture.py).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveAll, evaluate, isRecipe, RecipeError, type Recipe } from "../../src/page/recipes";

const fixture = JSON.parse(readFileSync("tests/fixtures/recipe_cases.json", "utf8")) as {
  catalogue: { id: string; source: Record<string, unknown> }[];
  cases: { inputs: Record<string, number | string>; derived: Record<string, number> }[];
};

describe("the shared recipe fixture", () => {
  it("has cases to check", () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(fixture.cases[0].derived)).toEqual(
      ["wickets_in_hand", "runs_x_wickets_in_hand", "is_ipl", "is_bbl"]);
  });

  it("gives the backend's value for every derived feature in every case", () => {
    for (const c of fixture.cases) {
      expect(deriveAll(fixture.catalogue, c.inputs)).toEqual(c.derived);
    }
  });
});

describe("evaluate", () => {
  it("difference: a constant minus a column, or a column minus a column", () => {
    expect(evaluate({ difference: { from: 10, of: "w" } }, { w: 3 })).toBe(7);
    expect(evaluate({ difference: { from: "a", of: "b" } }, { a: 9, b: 4 })).toBe(5);
  });
  it("product of two columns", () => {
    expect(evaluate({ product: ["a", "b"] }, { a: 6, b: 7 })).toBe(42);
  });
  it("indicator is 1 when equal and 0 otherwise", () => {
    const r: Recipe = { indicator: { column: "competition", equals: "ipl" } };
    expect(evaluate(r, { competition: "ipl" })).toBe(1);
    expect(evaluate(r, { competition: "bbl" })).toBe(0);
  });
  it("a missing input is a clear error, and isRecipe tells recipes from measured sources", () => {
    expect(() => evaluate({ product: ["a", "b"] }, { a: 1 })).toThrow(RecipeError);
    expect(isRecipe({ measured: true })).toBe(false);
    expect(isRecipe({ product: ["a", "b"] })).toBe(true);
  });
  it("deriveAll leaves out what cannot be computed from the inputs given", () => {
    expect(deriveAll(fixture.catalogue, { wickets_at_10: 2 })).toEqual({ wickets_in_hand: 8 });
  });
});
