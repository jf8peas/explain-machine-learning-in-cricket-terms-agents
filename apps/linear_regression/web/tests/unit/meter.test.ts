import { describe, expect, it } from "vitest";
import { NARROW_CLOSE, WIDE_CLOSE, layoutRows, position, zoneWidth } from "../../src/page/meter";

const SCALE = { min: 15, max: 33 };
const MARKS = [
  { id: "know_nothing", value: 29.4 },
  { id: "broadcaster", value: 21.8 },
  { id: "goal", value: 18.8 },
];

describe("position", () => {
  it("is 0 at the minimum, 100 at the maximum and 50 halfway", () => {
    expect(position(15, SCALE)).toBe(0);
    expect(position(33, SCALE)).toBe(100);
    expect(position(24, SCALE)).toBe(50);
  });
  it("is rounded to one decimal", () => {
    expect(position(1, { min: 0, max: 3 })).toBe(33.3);
  });
  it("is kept between 0 and 100", () => {
    expect(position(10, SCALE)).toBe(0);
    expect(position(40, SCALE)).toBe(100);
  });
  it("gives today's three marks 21.1, 37.8 and 80.0, increasing with the value", () => {
    const p = MARKS.map((m) => position(m.value, SCALE));
    expect(p).toEqual([80, 37.8, 21.1]);
    expect(position(18.8, SCALE)).toBeLessThan(position(21.8, SCALE));
    expect(position(21.8, SCALE)).toBeLessThan(position(29.4, SCALE));
  });
});

describe("zoneWidth", () => {
  it("equals the goal mark's position", () => {
    expect(zoneWidth(18.8, SCALE)).toBe(position(18.8, SCALE));
    expect(zoneWidth(18.8, SCALE)).toBe(21.1);
  });
});

const at = (pairs: Record<string, number>) => Object.entries(pairs).map(([id, pos]) => ({ id, position: pos }));

describe("layoutRows", () => {
  it("keeps marks that are far apart in the same row", () => {
    const rows = layoutRows(at({ know_nothing: 80, broadcaster: 37.8, goal: 21.1 }));
    expect(new Set(Object.values(rows).map((r) => r.rowWide))).toEqual(new Set([0]));
    expect(new Set(Object.values(rows).map((r) => r.rowNarrow))).toEqual(new Set([0]));
  });
  it("puts two marks closer than the wide threshold into different rows on wide screens", () => {
    const rows = layoutRows(at({ know_nothing: 90, broadcaster: 50, goal: 50 - (WIDE_CLOSE - 1) }));
    expect(rows.goal.rowWide).not.toBe(rows.broadcaster.rowWide);
  });
  it("leaves marks exactly at the wide threshold in the same row", () => {
    const rows = layoutRows(at({ know_nothing: 90, broadcaster: 50, goal: 50 - WIDE_CLOSE }));
    expect(rows.goal.rowWide).toBe(rows.broadcaster.rowWide);
  });
  it("puts the goal above the line and the references below on narrow screens", () => {
    const rows = layoutRows(at({ know_nothing: 80, broadcaster: 37.8, goal: 21.1 }));
    expect(rows.goal.sideNarrow).toBe("above");
    expect(rows.broadcaster.sideNarrow).toBe("below");
    expect(rows.know_nothing.sideNarrow).toBe("below");
  });
  it("puts two references closer than the narrow threshold into different rows on narrow screens", () => {
    const rows = layoutRows(at({ know_nothing: 60 + NARROW_CLOSE - 1, broadcaster: 60, goal: 40 }));
    expect(rows.know_nothing.rowNarrow).not.toBe(rows.broadcaster.rowNarrow);
  });
  it("does not let the goal affect the references' rows on narrow screens", () => {
    const rows = layoutRows(at({ know_nothing: 90, broadcaster: 21.1 + 2, goal: 21.1 }));
    expect(rows.broadcaster.rowNarrow).toBe(0);
    expect(rows.goal.rowNarrow).toBe(0);
  });
  it("gives the same result whatever order the marks are given in", () => {
    const base = at({ know_nothing: 55, broadcaster: 50, goal: 46 });
    const flipped = [...base].reverse();
    const shuffled = [base[1], base[2], base[0]];
    expect(layoutRows(flipped)).toEqual(layoutRows(base));
    expect(layoutRows(shuffled)).toEqual(layoutRows(base));
  });
});
