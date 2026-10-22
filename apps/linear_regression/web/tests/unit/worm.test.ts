import { describe, expect, it } from "vitest";
import { wormPlan, zoomGeometryFor, zoomPlan, type WormInput, type ZoomPlan } from "../../src/page/worm";
import { missWords, zoomRange } from "../../src/page/worm-layout";
import { close, current, highTotals, input, lowTotals, runsFor, spotOn, tvOver } from "./worm-fixtures";

const CASES: [string, () => WormInput][] = [["current", current], ["close", close], ["tvOver", tvOver], ["spotOn", spotOn], ["lowTotals", lowTotals], ["highTotals", highTotals]];
const modes = ["wide", "narrow"] as const;

const labelBoxes = (z: ZoomPlan) => z.labels.map((l) => ({ id: l.id, top: l.y - z.geometry.label, bottom: l.y + 4 }));
const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) => a.top < b.bottom && b.top < a.bottom;

describe("the line graph", () => {
  it("spaces all 20 overs evenly, with over 10 exactly halfway", () => {
    for (const mode of modes) for (const [, make] of CASES) {
      const l = wormPlan(make(), mode).line;
      const gap = l.overX(1) - l.overX(0);
      for (let o = 1; o <= 20; o++) expect(l.overX(o) - l.overX(o - 1)).toBeCloseTo(gap, 9);
      expect(l.overX(10)).toBeCloseTo((l.geometry.left + l.geometry.right) / 2, 9);
      expect(l.midX).toBe(l.overX(10));
      expect(l.finishX).toBe(l.geometry.right);
    }
  });

  it("draws overs 0 to 10 in the context band and overs 10 to 20 in the prediction area", () => {
    const l = wormPlan(current(), "wide").line;
    expect(l.context.x).toBe(l.geometry.left);
    expect(l.context.x + l.context.width).toBeCloseTo(l.midX, 9);
    expect(l.prediction.x).toBeCloseTo(l.midX, 9);
    expect(l.prediction.x + l.prediction.width).toBeCloseTo(l.finishX, 9);
    expect(l.contextLine).toHaveLength(11);
    expect(l.actualLast10).toHaveLength(11);
    expect(l.contextLine[0].y).toBe(l.geometry.bottom);                  // zero runs at the start
    expect(l.contextLine[10]).toEqual(l.actualLast10[0]);                // they join at the dot
    expect(l.contextLine[10]).toEqual(l.dot);
    expect(l.actualLast10[10]).toEqual(l.actual);
    expect(l.actual.x).toBe(l.finishX);
  });

  it("heads the two areas as the design says", () => {
    const l = wormPlan(current(), "wide").line;
    expect(l.headings.context).toEqual(["CONTEXT", "first 10 overs"]);
    expect(l.headings.prediction[0]).toBe("THE PREDICTION");
    expect(l.headings.prediction.slice(1).join("")).toBe("where will the last 10 overs take it?");
    expect(l.dotLabel).toBe("82/2");
  });

  it("puts the broadcaster and the know-nothing markers on the finish line at their totals", () => {
    const l = wormPlan(current(), "wide").line;
    const sy = (r: number) => l.geometry.bottom - (r / l.axis.max) * (l.geometry.bottom - l.geometry.top);
    expect(l.tv).toEqual({ x: l.finishX, y: sy(164) });
    expect(l.nothing).toEqual({ x: l.finishX, y: sy(162) });
    expect(l.actual.y).toBeCloseTo(sy(186), 9);
  });

  it("puts a wicket circle at each over with a wicket, in the right band, but not on the dot (over 10) or the diamond (over 20)", () => {
    const p = wormPlan(input({ wicket_overs: [2, 10, 11, 19, 20] }), "wide").line;
    expect(p.wickets.map((w) => [w.over, w.band])).toEqual([[2, "context"], [11, "prediction"], [19, "prediction"]]);
    expect(p.wickets[0].pt).toEqual(p.contextLine[2]);
    expect(p.wickets[2].pt).toEqual(p.actualLast10[9]);
    expect(wormPlan(input({ wicket_overs: [10, 20] }), "wide").line.wickets).toEqual([]);
    expect(wormPlan(input({ wicket_overs: [1, 9] }), "wide").line.wickets.every((w) => w.band === "context")).toBe(true);
  });

  it("keeps the axis at 200 when everything fits, and extends it in steps of 50 when something does not", () => {
    expect(wormPlan(current(), "wide").line.axis.max).toBe(200);
    expect(wormPlan(input({ runs: runsFor(120, 230), runs_at_10: 120, final_total: 230, tv_projection: 220 }), "wide").line.axis.max).toBe(250);
    expect(wormPlan(input({}, { averageTotal: 230 }), "wide").line.axis.max).toBe(250);
  });

  it("includes the top of the broadcaster's miss band when extending the axis", () => {
    expect(wormPlan(input({ tv_projection: 190 }, { averageMiss: 30 }), "wide").line.axis.max).toBe(250);   // 190 + 30 = 220
  });

  it("has no end labels, error bar, thin series or key in the plan", () => {
    const p = wormPlan(current(), "wide") as unknown as Record<string, unknown>;
    for (const gone of ["labels", "bar", "barLabel", "thin", "thick", "final"]) expect(p).not.toHaveProperty(gone);
  });
});

describe("the panels", () => {
  it("split the wide drawing 60/40 within one percentage point", () => {
    const p = wormPlan(current(), "wide");
    expect(p.layout).toBe("split");
    expect(p.line.geometry.panel / p.line.geometry.width).toBeCloseTo(0.6, 9);
    expect(Math.abs(p.shares.line - 0.6)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(p.shares.zoom - 0.4)).toBeLessThanOrEqual(0.011);
    expect(p.zoom.card.x).toBeGreaterThanOrEqual(p.line.geometry.panel);
    expect(p.zoom.card.x + p.zoom.card.width).toBeLessThanOrEqual(p.line.geometry.width);
    expect(p.line.finishX).toBeLessThan(p.line.geometry.panel);
  });

  it("stack in narrow mode: no joining lines, both at full width", () => {
    const p = wormPlan(current(), "narrow");
    expect(p.layout).toBe("stacked");
    expect(p.joins).toEqual([]);
    expect(p.shares).toEqual({ line: 1, zoom: 1 });
    expect(p.line.geometry.panel).toBe(p.line.geometry.width);
    expect(p.zoom.card.x + p.zoom.card.width).toBeLessThanOrEqual(p.line.geometry.width);
  });

  it("join the lens to the zoom card's top-left and bottom-left corners in wide mode", () => {
    const p = wormPlan(current(), "wide");
    expect(p.joins).toHaveLength(2);
    expect(p.joins[0]).toMatchObject({ x2: p.zoom.card.x, y2: p.zoom.card.y, y1: p.line.lens.top });
    expect(p.joins[1]).toMatchObject({ x2: p.zoom.card.x, y2: p.zoom.card.y + p.zoom.card.height, y1: p.line.lens.bottom });
    expect(p.joins[0].x1).toBeGreaterThan(p.line.finishX);
  });

  it("keep the lens on the finish line, spanning the zoom range on the line graph's own scale", () => {
    const p = wormPlan(current(), "wide");
    const sy = (r: number) => p.line.geometry.bottom - (r / p.line.axis.max) * (p.line.geometry.bottom - p.line.geometry.top);
    expect(p.line.lens.x).toBe(p.line.finishX);
    expect(p.line.lens.top).toBeCloseTo(sy(p.zoom.range.hi), 9);
    expect(p.line.lens.bottom).toBeCloseTo(sy(p.zoom.range.lo), 9);
  });

  it("clamp the lens inside the plot when the zoom range pads past the axis (a high total) or below zero (a very low one)", () => {
    for (const make of [highTotals, lowTotals]) {
      const p = wormPlan(make(), "wide");
      expect(p.line.lens.top).toBeGreaterThanOrEqual(p.line.geometry.top);
      expect(p.line.lens.bottom).toBeLessThanOrEqual(p.line.geometry.bottom);
      expect(p.line.lens.bottom).toBeGreaterThanOrEqual(p.line.lens.top);
    }
    expect(highTotals().example.final_total).toBe(199);
    expect(wormPlan(highTotals(), "wide").zoom.range.hi).toBeGreaterThan(200);
  });

  it("are the same every time for the same input and mode", () => {
    // the plan holds two scale functions; compare the data and what the functions return
    const view = (p: ReturnType<typeof wormPlan>) => ({
      data: JSON.parse(JSON.stringify(p)), overs: Array.from({ length: 21 }, (_, o) => p.line.overX(o)),
      scale: [60, 100, 150, 200, 240].map((v) => p.zoom.scale(v)),
    });
    for (const mode of modes) for (const [, make] of CASES) expect(view(wormPlan(make(), mode))).toEqual(view(wormPlan(make(), mode)));
  });
});

describe("zoomPlan", () => {
  for (const mode of modes) for (const [name, make] of CASES) {
    describe(`${name} (${mode})`, () => {
      const inp = make();
      const z = wormPlan(inp, mode).zoom;
      const e = inp.example;

      it("separates the labels, keeping them inside the ruler band", () => {
        const sorted = [...z.labels].sort((a, b) => a.y - b.y);
        sorted.forEach((l, i) => i === 0 || expect(l.y - sorted[i - 1].y).toBeGreaterThanOrEqual(22 - 1e-9));
        const boxes = labelBoxes(z);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
        for (const l of z.labels) expect(l.y).toBeLessThanOrEqual(z.agent.y);
      });

      it("keeps the agent box under the lowest label and above the key, overlapping neither", () => {
        const lowest = Math.max(...z.labels.map((l) => l.y));
        expect(z.agent.y).toBeGreaterThan(lowest);
        expect(z.agent.y + z.agent.height).toBeLessThanOrEqual(z.key.y);
        expect(z.key.y + z.key.height).toBeLessThanOrEqual(z.card.y + z.card.height);
        expect(overlap({ top: z.agent.y, bottom: z.agent.y + z.agent.height }, { top: z.key.y, bottom: z.key.y + z.key.height })).toBe(false);
        for (const b of labelBoxes(z)) expect(overlap(b, { top: z.agent.y, bottom: z.agent.y + z.agent.height })).toBe(false);
      });

      it("spans the broadcaster's usual miss exactly from projection - miss to projection + miss on the zoom's scale", () => {
        expect(z.usualMiss.top).toBeCloseTo(z.scale(e.tv_projection + inp.averageMiss), 9);
        expect(z.usualMiss.bottom).toBeCloseTo(z.scale(e.tv_projection - inp.averageMiss), 9);
        expect(z.usualMiss.from).toBeCloseTo(e.tv_projection - inp.averageMiss, 9);
        expect(z.usualMiss.to).toBeCloseTo(e.tv_projection + inp.averageMiss, 9);
        expect(z.usualMiss.text).toBe(`Usual miss, ±${inp.averageMiss.toFixed(1)}`);
        expect(z.usualMiss.top).toBeLessThan(z.usualMiss.bottom);
      });

      it("words the bracket from the displayed whole numbers and spans the broadcaster's value to the actual total", () => {
        const words = missWords(e.final_total, e.tv_projection);
        expect(z.bracket.words).toBe(words);
        expect(z.labels.find((l) => l.id === "miss")!.text).toBe(words);
        expect(z.bracket.direction).toBe(e.final_total > e.tv_projection ? "short" : e.final_total < e.tv_projection ? "over" : "spot on");
        expect(z.bracket.top).toBeCloseTo(z.scale(Math.max(e.final_total, e.tv_projection)), 9);
        expect(z.bracket.bottom).toBeCloseTo(z.scale(Math.min(e.final_total, e.tv_projection)), 9);
      });

      it("puts every marker and the whole miss band on the ruler, with room to spare", () => {
        const r = z.range;
        for (const v of [e.final_total, e.tv_projection, Math.round(inp.averageTotal), e.tv_projection - inp.averageMiss, e.tv_projection + inp.averageMiss]) {
          expect(v).toBeGreaterThanOrEqual(r.lo + 2 - 1e-9);
          expect(v).toBeLessThanOrEqual(r.hi - 2 + 1e-9);
        }
        expect(z.markers.actual.y).toBeCloseTo(z.scale(e.final_total), 9);
        expect(z.markers.tv.y).toBeCloseTo(z.scale(e.tv_projection), 9);
        expect(z.ruler.ticks.map((t) => t.value)).toEqual(r.ticks);
        z.ruler.ticks.forEach((t, i) => i === 0 || expect(t.y).toBeLessThan(z.ruler.ticks[i - 1].y));      // higher totals are higher up
      });

      it("labels the three predictions with their totals", () => {
        const text = (id: string) => z.labels.find((l) => l.id === id)!.text;
        expect(text("actual")).toBe(`Actual ${e.final_total}`);
        expect(text("tv")).toBe(`Broadcaster ${e.tv_projection}`);
        expect(text("nothing")).toBe(`Average-total guess ${Math.round(inp.averageTotal)}`);
        expect(z.title).toEqual(["ZOOM ON THE FINISH", "total after 20 overs"]);
      });
    });
  }

  it("reads the current innings as in the design: 22 runs short, labels Actual 186, Broadcaster 164 and Average-total guess 162", () => {
    const z = wormPlan(current(), "wide").zoom;
    expect(z.bracket.words).toBe("22 runs short");
    expect(z.labels.map((l) => l.text).sort()).toEqual(["22 runs short", "Actual 186", "Average-total guess 162", "Broadcaster 164"]);
    expect(z.range).toEqual(zoomRange({ actual: 186, tv: 164, nothing: 162 }, 22.5));
  });

  it("keeps the broadcaster and the know-nothing guess apart when they are within 2 runs, and says over when the broadcaster is above the total", () => {
    const c = wormPlan(close(), "wide").zoom;
    const tv = c.labels.find((l) => l.id === "tv")!, kn = c.labels.find((l) => l.id === "nothing")!;
    expect(Math.abs(tv.y - kn.y)).toBeGreaterThanOrEqual(22 - 1e-9);
    expect(Math.abs(c.markers.tv.y - c.markers.nothing.y)).toBeLessThan(22);          // the markers really are close, so the labels had to be spread
    expect(wormPlan(tvOver(), "wide").zoom.bracket.words).toBe("21 runs over");
    expect(wormPlan(spotOn(), "wide").zoom.bracket.words).toBe("spot on");
  });

  it("never overlaps its labels or the agent box, whatever the values (a sweep)", () => {
    for (const mode of modes) {
      const g = zoomGeometryFor(mode);
      for (let actual = 60; actual <= 240; actual += 18) for (let tvOff = -40; tvOff <= 40; tvOff += 8) for (const nothingOff of [-30, -3, -1, 0, 1, 3, 30]) for (const miss of [0.4, 12, 22.5, 40]) {
        const tv = actual + tvOff;
        const z = zoomPlan(input({ final_total: actual, tv_projection: tv }, { averageTotal: tv + nothingOff, averageMiss: miss }), g);
        const sorted = [...z.labels].sort((a, b) => a.y - b.y);
        sorted.forEach((l, i) => i === 0 || expect(l.y - sorted[i - 1].y).toBeGreaterThanOrEqual(22 - 1e-9));
        expect(z.agent.y).toBeGreaterThan(sorted[sorted.length - 1].y);
        expect(z.agent.y + z.agent.height).toBeLessThanOrEqual(z.key.y);
      }
    }
  });
});
