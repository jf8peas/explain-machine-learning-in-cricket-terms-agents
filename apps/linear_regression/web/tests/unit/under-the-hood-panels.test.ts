import { describe, expect, it } from "vitest";
import { PANEL_COUNT, allOpen, initial, nextAll, setAll, toggle, toggleAllLabel } from "../../src/page/under-the-hood/panels";

const openCount = (s: readonly boolean[]) => s.filter(Boolean).length;

describe("the stage panels' state", () => {
  it("starts with seven closed panels", () => {
    expect(PANEL_COUNT).toBe(7);
    expect(initial()).toEqual([false, false, false, false, false, false, false]);
  });

  it("opens and closes one panel and leaves the others alone", () => {
    const opened = toggle(initial(), 3);
    expect(opened.map((o, i) => (o ? i : -1)).filter((i) => i >= 0)).toEqual([3]);
    expect(toggle(opened, 3)).toEqual(initial());
    expect(openCount(toggle(opened, 5))).toBe(2);
  });

  it("sets every panel at once", () => {
    expect(openCount(setAll(initial(), true))).toBe(7);
    expect(openCount(setAll(setAll(initial(), true), false))).toBe(0);
  });

  it("labels the button Expand all until all seven are open", () => {
    expect(toggleAllLabel(initial())).toBe("Expand all");
    expect(toggleAllLabel(toggle(initial(), 0))).toBe("Expand all");
    expect(toggleAllLabel(setAll(initial(), true))).toBe("Collapse all");
  });

  it("follows the real state when panels are opened or closed one by one", () => {
    let state = initial();
    for (let i = 0; i < 6; i++) state = toggle(state, i);
    expect(toggleAllLabel(state)).toBe("Expand all");
    state = toggle(state, 6);
    expect(allOpen(state)).toBe(true);
    expect(toggleAllLabel(state)).toBe("Collapse all");
    state = toggle(state, 2);
    expect(toggleAllLabel(state)).toBe("Expand all");
  });

  it("opens the rest when some are open, and closes all only when all are open", () => {
    expect(openCount(nextAll(initial()))).toBe(7);
    expect(openCount(nextAll(toggle(toggle(initial(), 1), 4)))).toBe(7);
    expect(openCount(nextAll(setAll(initial(), true)))).toBe(0);
  });

  it("ignores an index outside the panels and never changes its input", () => {
    const state = initial();
    expect(toggle(state, -1)).toEqual(initial());
    expect(toggle(state, 7)).toEqual(initial());
    expect(toggle(state, 1.5)).toEqual(initial());
    toggle(state, 0);
    setAll(state, true);
    nextAll(state);
    expect(state).toEqual(initial());
  });
});
