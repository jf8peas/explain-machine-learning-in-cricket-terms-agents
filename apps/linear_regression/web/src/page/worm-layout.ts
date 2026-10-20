// The worm chart's geometry (app-specific, pure): the y axis, where the end labels go so they never overlap, and whether
// they fit beside the chart at all. It works out no figure; every value it is given comes from the server.

export const BASE_MAX = 200;   // runs at the top of the axis unless a plotted value needs more
export const STEP = 50;        // gridline and label spacing, and the steps the axis grows in
export const NARROW_BELOW = 560; // a chart card narrower than this (px) stacks the zoom under the line graph

export interface YAxis { max: number; ticks: number[] }

/** 0 to 200 in steps of 50, grown in whole steps when any plotted value is higher. */
export function yAxis(values: number[]): YAxis {
  const top = Math.max(BASE_MAX, ...values.filter((v) => Number.isFinite(v)));
  const max = Math.ceil(top / STEP - 1e-9) * STEP;
  return { max, ticks: Array.from({ length: max / STEP + 1 }, (_, i) => i * STEP) };
}

/** Wide: one drawing with the line graph and the zoom side by side. Narrow: the zoom stacked under the line graph. */
export type Mode = "wide" | "narrow";
export function layoutMode(cardWidth: number): Mode {
  return cardWidth >= NARROW_BELOW ? "wide" : "narrow";
}

export const ZOOM_PAD = 2;     // runs of room beyond the lowest and highest value before rounding out to a 10
export const ZOOM_STEP = 10;   // tick spacing on the zoom's ruler, in runs

export interface ZoomRange { lo: number; hi: number; ticks: number[] }

/** The totals the zoom's ruler covers: from the nearest 10 below the lowest of (actual, TV, know-nothing, TV - miss) to the
 *  nearest 10 above the highest of (those and TV + miss), with ZOOM_PAD runs of room so no marker sits on an edge, and at
 *  least one tick interval. Ticks every 10 runs, ends included. Layout only: it works out no statistic. */
export function zoomRange(values: { actual: number; tv: number; nothing: number }, averageMiss: number): ZoomRange {
  const all = [values.actual, values.tv, values.nothing, values.tv - averageMiss, values.tv + averageMiss];
  const lo = Math.floor((Math.min(...all) - ZOOM_PAD) / ZOOM_STEP) * ZOOM_STEP;
  let hi = Math.ceil((Math.max(...all) + ZOOM_PAD) / ZOOM_STEP) * ZOOM_STEP;
  if (hi - lo < ZOOM_STEP) hi = lo + ZOOM_STEP;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += ZOOM_STEP) ticks.push(t);
  return { lo, hi, ticks };
}

/** How far the TV was from the total, in words, from the displayed whole numbers: "22 runs short" when it said less than
 *  the total, "21 runs over" when it said more, "1 run" for one, "spot on" when equal. The server's caption uses the same rule. */
export function missWords(actual: number, tv: number): string {
  const n = Math.round(actual) - Math.round(tv);
  if (n === 0) return "spot on";
  const size = Math.abs(n);
  return `${size} ${size === 1 ? "run" : "runs"} ${n > 0 ? "short" : "over"}`;
}

export interface Wish { id: string; y: number }

/** Where each label's baseline goes. `wished` is where each would like to sit (smaller y is higher up). Labels keep their
 *  order by wished position (ties in the order given), are at least `gap` apart, and stay between `top` and `bottom`. If
 *  they cannot all fit in that height they are packed as tightly as possible from the top. */
export function spreadLabels(wished: Wish[], gap: number, top: number, bottom: number): Record<string, number> {
  const sorted = wished.map((w, i) => ({ ...w, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const ys = sorted.map((w) => w.y);
  for (let k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k], k === 0 ? top : ys[k - 1] + gap);   // push down
  const last = ys.length - 1;
  if (last >= 0 && ys[last] > bottom) {                                                              // then pull back up
    ys[last] = Math.max(bottom, top + gap * last);
    for (let k = last - 1; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - gap);
    for (let k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k], top + gap * k);
  }
  return Object.fromEntries(sorted.map((w, k) => [w.id, ys[k]]));
}
