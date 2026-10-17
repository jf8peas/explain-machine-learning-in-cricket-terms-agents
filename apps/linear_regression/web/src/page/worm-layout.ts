// The worm chart's geometry (app-specific, pure): the y axis, where the end labels go so they never overlap, and whether
// they fit beside the chart at all. It works out no figure; every value it is given comes from the server.

export const BASE_MAX = 200;   // runs at the top of the axis unless a plotted value needs more
export const STEP = 50;        // gridline and label spacing, and the steps the axis grows in
export const NARROW_BELOW = 560; // a chart card narrower than this (px) puts the end labels in a key under the chart

export interface YAxis { max: number; ticks: number[] }

/** 0 to 200 in steps of 50, grown in whole steps when any plotted value is higher. */
export function yAxis(values: number[]): YAxis {
  const top = Math.max(BASE_MAX, ...values.filter((v) => Number.isFinite(v)));
  const max = Math.ceil(top / STEP - 1e-9) * STEP;
  return { max, ticks: Array.from({ length: max / STEP + 1 }, (_, i) => i * STEP) };
}

/** Beside the chart when there is room for the labels, otherwise in a key under it. */
export function labelMode(cardWidth: number): "side" | "key" {
  return cardWidth >= NARROW_BELOW ? "side" : "key";
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
