import { describe, expect, it } from "vitest";
import { labelMode, NARROW_BELOW, spreadLabels, yAxis } from "../../src/page/worm-layout";

describe("yAxis", () => {
  it("is 0 to 200 in steps of 50 when every value fits", () => {
    expect(yAxis([186, 164, 162, 90])).toEqual({ max: 200, ticks: [0, 50, 100, 150, 200] });
  });

  it("stays at 200 for a value exactly on 200", () => {
    expect(yAxis([200]).max).toBe(200);
  });

  it("grows in whole steps of 50 when a plotted value is higher", () => {
    expect(yAxis([201]).max).toBe(250);
    expect(yAxis([250]).max).toBe(250);
    expect(yAxis([251]).max).toEqual(300);
    expect(yAxis([186, 233.4, 162]).ticks).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it("ignores values that are not numbers", () => {
    expect(yAxis([NaN, 120]).max).toBe(200);
  });
});

describe("labelMode", () => {
  it("puts the labels beside a wide chart and in a key under a narrow one", () => {
    expect(labelMode(NARROW_BELOW)).toBe("side");
    expect(labelMode(NARROW_BELOW - 1)).toBe("key");
    expect(labelMode(328)).toBe("key");
  });
});

const GAP = 22;
const apart = (ys: Record<string, number>, gap = GAP) => {
  const v = Object.values(ys).sort((a, b) => a - b);
  return v.every((y, i) => i === 0 || y - v[i - 1] >= gap - 1e-9);
};

describe("spreadLabels", () => {
  it("leaves labels that are already far apart where they wished to be", () => {
    const ys = spreadLabels([{ id: "a", y: 60 }, { id: "b", y: 120 }, { id: "c", y: 200 }], GAP, 20, 300);
    expect(ys).toEqual({ a: 60, b: 120, c: 200 });
  });

  it("pushes three nearly equal values apart, keeping their order", () => {
    const ys = spreadLabels([{ id: "actual", y: 64 }, { id: "tv", y: 64.4 }, { id: "nothing", y: 65 }], GAP, 20, 300);
    expect(apart(ys)).toBe(true);
    expect(ys.actual).toBeLessThan(ys.tv);
    expect(ys.tv).toBeLessThan(ys.nothing);
  });

  it("keeps the order of equal wishes as given", () => {
    const ys = spreadLabels([{ id: "x", y: 100 }, { id: "y", y: 100 }, { id: "z", y: 100 }], GAP, 20, 300);
    expect(ys.x).toBeLessThan(ys.y);
    expect(ys.y).toBeLessThan(ys.z);
    expect(apart(ys)).toBe(true);
  });

  it("orders by wished position, not by the order given", () => {
    const ys = spreadLabels([{ id: "low", y: 200 }, { id: "high", y: 50 }], GAP, 20, 300);
    expect(ys.high).toBeLessThan(ys.low);
  });

  it("stays inside the plot: labels crowded at the bottom are pulled up", () => {
    const ys = spreadLabels([{ id: "a", y: 296 }, { id: "b", y: 298 }, { id: "c", y: 300 }, { id: "d", y: 300 }], GAP, 20, 300);
    expect(apart(ys)).toBe(true);
    for (const y of Object.values(ys)) { expect(y).toBeGreaterThanOrEqual(20); expect(y).toBeLessThanOrEqual(300); }
  });

  it("stays inside the plot: labels crowded at the top are pushed down", () => {
    const ys = spreadLabels([{ id: "a", y: 0 }, { id: "b", y: 1 }, { id: "c", y: 2 }], GAP, 20, 300);
    expect(Math.min(...Object.values(ys))).toBeGreaterThanOrEqual(20);
    expect(apart(ys)).toBe(true);
  });

  it("packs from the top, still apart, when the height is too small for all of them", () => {
    const ys = spreadLabels([{ id: "a", y: 50 }, { id: "b", y: 50 }, { id: "c", y: 50 }], GAP, 20, 40);
    expect(apart(ys)).toBe(true);
    expect(ys.a).toBe(20);
  });

  it("handles one label and none", () => {
    expect(spreadLabels([{ id: "a", y: 5 }], GAP, 20, 300)).toEqual({ a: 20 });
    expect(spreadLabels([], GAP, 20, 300)).toEqual({});
  });

  it("never overlaps, whatever the values (a sweep)", () => {
    for (let a = 0; a <= 320; a += 20) for (let b = 0; b <= 320; b += 20) for (let c = 0; c <= 320; c += 40) {
      const ys = spreadLabels([{ id: "a", y: a }, { id: "b", y: b }, { id: "c", y: c }, { id: "d", y: Math.max(a, b, c) + 30 }], GAP, 20, 300);
      expect(apart(ys)).toBe(true);
      for (const y of Object.values(ys)) { expect(y).toBeGreaterThanOrEqual(20); expect(y).toBeLessThanOrEqual(300 + 1e-9); }
    }
  });
});
