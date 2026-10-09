import { describe, expect, it } from "vitest";
import { checkLabels, menuLabeller, setupChips, type Menus } from "../../src/page/setup";

const MENUS: Menus = {
  window: [{ id: "all", label: "all available seasons" }, { id: "last_5", label: "the last 5 seasons" }],
  weighting: [{ id: "none", label: "every season counting equally" }, { id: "gentle", label: "recent seasons counting a little more" }],
  training_innings: [{ id: "population", label: "full-member and league innings only" }, { id: "all", label: "all innings" }],
};
const label = menuLabeller(MENUS);

describe("setupChips", () => {
  it("gives one chip for each part of the setup, in order, with the menu's own wording", () => {
    const chips = setupChips({ features: ["runs_at_10"], window: "last_5", weighting: "gentle", training_innings: "population" }, label);
    expect(chips.map((c) => c.part)).toEqual(["window", "weighting", "training_innings"]);
    expect(chips.map((c) => c.text)).toEqual(["the last 5 seasons", "recent seasons counting a little more", "full-member and league innings only"]);
  });
  it("leaves out a part that is not there", () => {
    expect(setupChips({ features: [], window: "all" }, label).map((c) => c.part)).toEqual(["window"]);
    expect(setupChips({ features: [] }, label)).toEqual([]);
  });
  it("falls back to the id when the menus have not arrived or do not know it", () => {
    const none = menuLabeller(undefined);
    expect(setupChips({ features: [], window: "last_5" }, none)[0].text).toBe("last_5");
    expect(setupChips({ features: [], window: "last_7" }, label)[0].text).toBe("last_7");
  });
});

describe("checkLabels", () => {
  it("labels each check error by its year, to one decimal", () => {
    expect(checkLabels([{ year: 2023, mae: 17.04 }, { year: 2024, mae: 18 }, { year: 2025, mae: 16.96 }])).toEqual(["2023: 17.0", "2024: 18.0", "2025: 17.0"]);
  });
  it("gives nothing when there are no checks", () => {
    expect(checkLabels(undefined)).toEqual([]);
    expect(checkLabels([])).toEqual([]);
  });
});
