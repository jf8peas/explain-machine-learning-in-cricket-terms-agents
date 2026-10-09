import { describe, expect, it } from "vitest";
import { buildUpLines, gridGroups, type Grid } from "../../src/page/grid";
import { menuLabeller, type Menus } from "../../src/page/setup";

const MENUS: Menus = {
  window: [{ id: "all", label: "all seasons" }, { id: "last_3", label: "last 3" }],
  weighting: [{ id: "none", label: "equal" }, { id: "gentle", label: "gentle" }, { id: "strong", label: "strong" }],
  training_innings: [{ id: "population", label: "league and full-member only" }, { id: "all", label: "all innings" }],
};
const label = menuLabeller(MENUS);

function cell(training_innings: string, window: string, weighting: string, mae: number | null, extra = {}) {
  return { training_innings, window, weighting, allowed: mae !== null, note: null, features: mae === null ? [] : ["runs_at_10"], validation_mae: mae, ...extra };
}
const cells = ["population", "all"].flatMap((i, a) => ["all", "last_3"].flatMap((w, b) =>
  ["none", "gentle", "strong"].map((g, c) => cell(i, w, g, 17 + a + b / 10 + c / 100))));
const GRID: Grid = {
  caption: "A caption.", cells, best: cells[0],
  build_up: [{ feature: "runs_at_10", validation_mae: 19.2 }, { feature: "wickets_in_hand", validation_mae: 17.0 }],
};

describe("gridGroups", () => {
  const groups = gridGroups(GRID, label);
  it("makes one grid for each training-innings choice, titled with the menu's wording, in the server's order", () => {
    expect(groups.map((g) => g.innings)).toEqual(["population", "all"]);
    expect(groups.map((g) => g.title)).toEqual(["league and full-member only", "all innings"]);
  });
  it("has the weightings as columns and the windows as rows, in the order the cells arrived", () => {
    expect(groups[0].weightings.map((w) => w.label)).toEqual(["equal", "gentle", "strong"]);
    expect(groups[0].rows.map((r) => r.label)).toEqual(["all seasons", "last 3"]);
    expect(groups[0].rows[0].cells.map((c) => c.weighting)).toEqual(["none", "gentle", "strong"]);
  });
  it("labels each cell with its error to one decimal and flags exactly the best cell", () => {
    expect(groups[0].rows[0].cells[0]).toMatchObject({ text: "17.0", best: true, allowed: true });
    const flagged = groups.flatMap((g) => g.rows.flatMap((r) => r.cells)).filter((c) => c.best);
    expect(flagged).toHaveLength(1);
  });
  it("labels a cell that was not allowed with its note and no error", () => {
    const thin = { ...GRID, cells: [cell("population", "all", "none", null, { note: "Only 50 innings in the 2023 check." }), ...cells.slice(1)], best: cells[1] };
    const c = gridGroups(thin, label)[0].rows[0].cells[0];
    expect(c).toMatchObject({ text: "too few", allowed: false, best: false, note: "Only 50 innings in the 2023 check." });
  });
  it("has no best cell when none is given", () => {
    expect(gridGroups({ ...GRID, best: null }, label).flatMap((g) => g.rows.flatMap((r) => r.cells)).some((c) => c.best)).toBe(false);
  });
});

describe("buildUpLines", () => {
  it("lists the winning cell's features one step at a time with the error after each", () => {
    expect(buildUpLines(GRID, (id) => `<${id}>`)).toEqual(["<runs_at_10>: 19.2", "<wickets_in_hand>: 17.0"]);
  });
});
