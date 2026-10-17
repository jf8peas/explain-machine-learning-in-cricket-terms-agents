import { describe, expect, it } from "vitest";
import { geometryFor, wormPlan, type WormInput } from "../../src/page/worm";

const RUNS = [9, 14, 16, 28, 45, 51, 59, 68, 73, 82, 87, 101, 114, 124, 139, 145, 157, 168, 175, 186];
const WICKETS = [0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 5];

function input(over: Partial<WormInput["example"]> = {}, rest: Partial<Omit<WormInput, "example">> = {}): WormInput {
  return {
    example: {
      match_id: "1", batting_team: "A", bowling_team: "B", venue: "V", date: "2020-12-08", date_label: "December 2020",
      runs: RUNS, wickets: WICKETS, runs_at_10: 82, wickets_at_10: 2, final_total: 186, tv_projection: 164, tv_miss: 22,
      wicket_overs: [2, 10, 19, 20], ...over,
    },
    averageMiss: 22.5, averageTotal: 162, chartText: "text", ...rest,
  };
}

describe("wormPlan", () => {
  it("draws the first 10 overs from 0 to the score at 10 overs and the last 10 from there to the final total", () => {
    const p = wormPlan(input(), "side");
    expect(p.thick).toHaveLength(11);
    expect(p.thin).toHaveLength(11);
    expect(p.thick[0].x).toBe(p.geometry.left);
    expect(p.thick[0].y).toBe(p.geometry.bottom);                     // zero runs at the start
    expect(p.thick[10]).toEqual(p.thin[0]);                           // they join at the dot
    expect(p.thick[10]).toEqual(p.dot);
    expect(p.thin[10]).toEqual(p.final);
    expect(p.final.x).toBe(p.geometry.right);
  });

  it("matches the approved design's geometry on the 0 to 200 axis", () => {
    const p = wormPlan(input(), "side");
    expect(p.dot.x).toBeCloseTo(325, 5);
    expect(p.dot.y).toBeCloseTo(205.2, 5);        // 82 runs
    expect(p.final.y).toBeCloseTo(59.6, 5);       // 186 runs
    expect(p.tv.y).toBeCloseTo(90.4, 5);          // 164
    expect(p.nothing.y).toBeCloseTo(93.2, 5);     // 162
    expect(p.bar.top).toBeCloseTo(58.9, 5);       // 164 + 22.5
    expect(p.bar.bottom).toBeCloseTo(121.9, 5);   // 164 - 22.5
  });

  it("labels the dot with the score at 10 overs and the bar with the TV's average miss", () => {
    const p = wormPlan(input(), "side");
    expect(p.dotLabel).toBe("82/2");
    expect(p.barLabel).toBe("TV's average miss: ±22.5 runs");
  });

  it("puts a wicket circle at each over with a wicket, but not on the dot (over 10) or the diamond (over 20)", () => {
    const p = wormPlan(input(), "side");
    expect(p.wickets.map((w) => w.over)).toEqual([2, 19]);
    expect(p.wickets[0].pt).toEqual(p.thick[2]);
    expect(p.wickets[1].future).toBe(true);
    expect(p.wickets[0].future).toBe(false);
  });

  it("omits the markers at overs 10 and 20 even when those are the only wickets", () => {
    expect(wormPlan(input({ wicket_overs: [10, 20] }), "side").wickets).toEqual([]);
  });

  it("keeps the axis at 200 when everything fits, and extends it in steps of 50 when something does not", () => {
    expect(wormPlan(input(), "side").axis.max).toBe(200);
    const tall = input({ runs: RUNS.map((r) => r + 40), final_total: 226, runs_at_10: 122, tv_projection: 244 }, { averageMiss: 30 });
    const p = wormPlan(tall, "side");
    expect(p.axis.max).toBe(300);                                    // 244 + 30 = 274 is the highest plotted value
    expect(p.bar.top).toBeGreaterThanOrEqual(p.geometry.top);        // the error bar stays inside the plot
    expect(p.final.y).toBeGreaterThanOrEqual(p.geometry.top);
  });

  it("includes the top of the TV's error bar when extending the axis", () => {
    const p = wormPlan(input({ tv_projection: 190 }, { averageMiss: 30 }), "side");
    expect(p.axis.max).toBe(250);
  });

  it("stacks the end labels in order of value, with the agent last, and never lets them overlap", () => {
    const p = wormPlan(input(), "side");
    expect(p.labels.map((l) => l.id)).toEqual(["actual", "tv", "nothing", "agent"]);
    expect(p.labels.map((l) => l.text)).toEqual(["Actual 186", "TV projection 164", "Know-nothing 162", "The agent: ?"]);
    for (let i = 1; i < p.labels.length; i++) expect(p.labels[i].y - p.labels[i - 1].y).toBeGreaterThanOrEqual(p.geometry.gap - 1e-9);
  });

  it("does not overlap labels when the three values are nearly equal", () => {
    const p = wormPlan(input({ final_total: 164, runs: [...RUNS.slice(0, 19), 164], tv_projection: 164 }, { averageTotal: 163.6 }), "side");
    for (let i = 1; i < p.labels.length; i++) expect(p.labels[i].y - p.labels[i - 1].y).toBeGreaterThanOrEqual(p.geometry.gap - 1e-9);
    expect(p.labels.every((l) => l.y >= p.geometry.top - 20 && l.y <= p.geometry.bottom)).toBe(true);
  });

  it("keeps the labels inside the plot when all the values are low", () => {
    const low = input({ runs: RUNS.map((r) => Math.round(r / 6)), runs_at_10: 14, final_total: 31, tv_projection: 28, wicket_overs: [] }, { averageTotal: 30, averageMiss: 3 });
    const p = wormPlan(low, "side");
    for (let i = 1; i < p.labels.length; i++) expect(p.labels[i].y - p.labels[i - 1].y).toBeGreaterThanOrEqual(p.geometry.gap - 1e-9);
    expect(Math.max(...p.labels.map((l) => l.y))).toBeLessThanOrEqual(p.geometry.bottom);
  });

  it("uses the narrow geometry for the key fallback, with the same labels to put in the key", () => {
    const narrow = wormPlan(input(), "key");
    expect(narrow.mode).toBe("key");
    expect(narrow.geometry).toBe(geometryFor("key"));
    expect(narrow.geometry.width).toBeLessThan(geometryFor("side").width);
    expect(narrow.labels.map((l) => l.text).sort()).toEqual(wormPlan(input(), "side").labels.map((l) => l.text).sort());
  });

  it("is the same every time for the same input", () => {
    expect(wormPlan(input(), "side")).toEqual(wormPlan(input(), "side"));
  });
});
