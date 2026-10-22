import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { layoutMode, missWords, NARROW_BELOW, spreadLabels, yAxis, ZOOM_PAD, ZOOM_STEP, zoomRange } from "../../src/page/worm-layout";

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

describe("layoutMode", () => {
  it("draws the line graph and the zoom side by side on a wide card and stacked on a narrow one", () => {
    expect(layoutMode(NARROW_BELOW)).toBe("wide");
    expect(layoutMode(NARROW_BELOW - 1)).toBe("narrow");
    expect(layoutMode(559)).toBe("narrow");
    expect(layoutMode(560)).toBe("wide");
    expect(layoutMode(328)).toBe("narrow");
  });
});

const CASES = JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/miss_words_cases.json", import.meta.url)), "utf8")) as { actual: number; tv: number; words: string }[];

describe("missWords", () => {
  it("says short, over or spot on for every shared case (the server's caption uses the same cases)", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(8);
    for (const c of CASES) expect(missWords(c.actual, c.tv), `${c.actual} v ${c.tv}`).toBe(c.words);
  });

  it("says short when the broadcaster is below the total and over when it is above", () => {
    expect(missWords(186, 164)).toBe("22 runs short");
    expect(missWords(150, 171)).toBe("21 runs over");
    expect(missWords(180, 180)).toBe("spot on");
  });

  it("uses the singular for one run and works on the displayed whole numbers", () => {
    expect(missWords(181, 180)).toBe("1 run short");
    expect(missWords(179, 180)).toBe("1 run over");
    expect(missWords(186, 164.4)).toBe("22 runs short");    // 164.4 is shown as 164
    expect(missWords(186, 164.6)).toBe("21 runs short");    // 164.6 is shown as 165
  });
});

describe("zoomRange", () => {
  const range = (actual: number, tv: number, nothing: number, miss: number) => zoomRange({ actual, tv, nothing }, miss);
  const contains = (r: ReturnType<typeof range>, v: number) => v >= r.lo + ZOOM_PAD - 1e-9 && v <= r.hi - ZOOM_PAD + 1e-9;

  it("for the current innings runs from the nearest 10 below the lowest value to the nearest 10 above the highest", () => {
    const r = range(186, 164, 162, 22.5);          // lowest 141.5 (projection - miss), highest 186.5 (projection + miss)
    expect(r).toEqual({ lo: 130, hi: 190, ticks: [130, 140, 150, 160, 170, 180, 190] });
  });

  it("keeps the broadcaster and the know-nothing guess apart on a magnified ruler when they are within 2 runs", () => {
    const r = range(186, 164, 163, 22.5);
    expect(r.hi - r.lo).toBeLessThanOrEqual(80);
    for (const v of [186, 164, 163, 164 - 22.5, 164 + 22.5]) expect(contains(r, v), String(v)).toBe(true);
  });

  it("covers the whole broadcaster band when the broadcaster is above the actual total", () => {
    const r = range(150, 171, 162, 22.5);          // band 148.5 to 193.5
    expect(r.lo).toBeLessThanOrEqual(140);
    expect(r.hi).toBeGreaterThanOrEqual(200);
    for (const v of [150, 171, 162, 148.5, 193.5]) expect(contains(r, v), String(v)).toBe(true);
  });

  it("extends past the plotted values when the broadcaster's miss band goes beyond them", () => {
    const r = range(60, 60, 58, 22.5);              // band 37.5 to 82.5, beyond all three totals
    expect(r.lo).toBeLessThanOrEqual(30);
    expect(r.hi).toBeGreaterThanOrEqual(90);
    for (const v of [60, 58, 37.5, 82.5]) expect(contains(r, v)).toBe(true);
  });

  it("is at least one tick interval wide when every value coincides", () => {
    const r = range(100, 100, 100, 0);
    expect(r.hi - r.lo).toBeGreaterThanOrEqual(ZOOM_STEP);
    expect(contains(r, 100)).toBe(true);
    expect(r.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("never lets a value sit on an edge, even when it is an exact multiple of 10", () => {
    const r = range(190, 170, 180, 0);              // lowest 170, highest 190: exact tens
    expect(r.lo).toBeLessThan(170);
    expect(r.hi).toBeGreaterThan(190);
    expect(170 - r.lo).toBeGreaterThanOrEqual(ZOOM_PAD);
    expect(r.hi - 190).toBeGreaterThanOrEqual(ZOOM_PAD);
  });

  it("has ticks every 10 runs from lo to hi, both included, and lo and hi are multiples of 10", () => {
    for (const [a, t, n, m] of [[186, 164, 162, 22.5], [150, 171, 162, 22.5], [60, 60, 58, 22.5], [199, 198, 196, 5], [101, 103, 99, 0.4]] as const) {
      const r = range(a, t, n, m);
      expect(r.lo % 10).toBe(0);
      expect(r.hi % 10).toBe(0);
      expect(r.ticks[0]).toBe(r.lo);
      expect(r.ticks[r.ticks.length - 1]).toBe(r.hi);
      r.ticks.forEach((tick, i) => i === 0 || expect(tick - r.ticks[i - 1]).toBe(10));
    }
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
