// The race chart's geometry (app-specific, pure): the y range that fits every plotted value with gridlines at whole runs,
// the x place of each round, and where the end labels go so they never overlap. It works out no figure; every value it is
// given comes from the run.
import { spreadLabels, type Wish } from "../worm-layout";

export const PLOT = { width: 700, height: 290, left: 60, right: 600, top: 30, bottom: 200, labelX: 608, gap: 17 };
const MAX_TICKS = 7;

export interface YRange { min: number; max: number; ticks: number[] }

/** A range covering every value with a little room, and a gridline at each whole run (every few runs when the span is wide). */
export function yRange(values: number[]): YRange {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return { min: 0, max: 1, ticks: [0, 1] };
  let min = Math.floor(Math.min(...finite) - 0.3);
  let max = Math.ceil(Math.max(...finite) + 0.3);
  if (max - min < 2) max = min + 2;
  const step = Math.max(1, Math.ceil((max - min) / (MAX_TICKS - 1)));
  max = min + Math.ceil((max - min) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { min, max, ticks };
}

export const yPlace = (range: YRange, value: number): number =>
  PLOT.bottom - ((value - range.min) / (range.max - range.min)) * (PLOT.bottom - PLOT.top);

/** The x place of round `round` (1-based) when `rounds` are shown. */
export function xPlace(round: number, rounds: number): number {
  const n = Math.max(1, rounds);
  return PLOT.left + ((round - 0.5) / n) * (PLOT.right - PLOT.left);
}

/** Where each end label's baseline goes: in order of value, at least the gap apart, inside the plot's height. */
export function endLabels(wished: Wish[]): Record<string, number> {
  return spreadLabels(wished, PLOT.gap, PLOT.top - 14, PLOT.bottom + 14);
}
