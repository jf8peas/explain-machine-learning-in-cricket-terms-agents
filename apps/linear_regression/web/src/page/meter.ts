// The miss meter's geometry (app-specific, pure): where a value sits on the server's scale and which row each mark's text
// uses so close marks do not overlap. It works out no figure; the values, the scale and the labels all come from the server.

export interface Scale { min: number; max: number }
export interface Placed { id: string; position: number }
export interface Rows { rowWide: number; rowNarrow: number; sideNarrow: "above" | "below" }

// Marks closer than this share of the track put their text on different rows. The wide figure covers the widest label
// pairs at about 768 px; the narrow one covers names that wrap to about 6.5 em at 360 px.
export const WIDE_CLOSE = 16;
export const NARROW_CLOSE = 30;
const GOAL = "goal";

/** A value's place on the line as a percentage from the left (better), one decimal, kept between 0 and 100. */
export function position(value: number, scale: Scale): number {
  const share = ((value - scale.min) / (scale.max - scale.min)) * 100;
  return Math.min(100, Math.max(0, Math.round(share * 10) / 10));
}

/** The goal zone runs from the left end of the line to the goal mark. */
export const zoneWidth = (goalValue: number, scale: Scale): number => position(goalValue, scale);

// Walk the marks left to right; a mark too close to the one before it, if that one is on the first row, takes the second.
function stagger(marks: Placed[], close: number): Record<string, number> {
  const sorted = [...marks].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const rows: Record<string, number> = {};
  sorted.forEach((m, i) => {
    const prev = sorted[i - 1];
    rows[m.id] = prev && m.position - prev.position < close && rows[prev.id] === 0 ? 1 : 0;
  });
  return rows;
}

/** Per mark: its row on wide screens, and on narrow screens its side of the line and its row. The goal is above the line
 *  on narrow screens and the references below, so the goal can never touch the projection (always only a margin apart). */
export function layoutRows(marks: Placed[]): Record<string, Rows> {
  const wide = stagger(marks, WIDE_CLOSE);
  const narrow = stagger(marks.filter((m) => m.id !== GOAL), NARROW_CLOSE);
  const out: Record<string, Rows> = {};
  for (const m of marks) {
    const isGoal = m.id === GOAL;
    out[m.id] = { rowWide: wide[m.id], rowNarrow: isGoal ? 0 : narrow[m.id], sideNarrow: isGoal ? "above" : "below" };
  }
  return out;
}
