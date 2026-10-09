// The rival's grid search as a table model (app-specific, pure). The server sends every combination of training innings,
// window and weighting with the best feature set found there; the page lays them out as one small grid for each
// training-innings choice (rows are windows, columns are weightings) and marks the best cell. Row and column order are the
// order the cells arrive in, so no window or weighting is named here.
import type { Labeller } from "./setup";

export interface GridCell {
  training_innings: string;
  window: string;
  weighting: string;
  allowed: boolean;
  note: string | null;
  features: string[];
  validation_mae: number | null;
}
export interface Grid {
  caption: string;
  cells: GridCell[];
  best: GridCell | null;
  build_up: { feature: string; validation_mae: number }[];
}
export interface CellView { weighting: string; text: string; best: boolean; allowed: boolean; note: string | null }
export interface RowView { window: string; label: string; cells: CellView[] }
export interface GroupView { innings: string; title: string; weightings: { id: string; label: string }[]; rows: RowView[] }

const unique = (items: string[]) => [...new Set(items)];

export function gridGroups(grid: Grid, label: Labeller): GroupView[] {
  const isBest = (c: GridCell) => grid.best !== null && c.training_innings === grid.best.training_innings &&
    c.window === grid.best.window && c.weighting === grid.best.weighting;
  const weightings = unique(grid.cells.map((c) => c.weighting));
  return unique(grid.cells.map((c) => c.training_innings)).map((innings) => {
    const mine = grid.cells.filter((c) => c.training_innings === innings);
    return {
      innings,
      title: label("training_innings", innings),
      weightings: weightings.map((id) => ({ id, label: label("weighting", id) })),
      rows: unique(mine.map((c) => c.window)).map((window) => ({
        window,
        label: label("window", window),
        cells: mine.filter((c) => c.window === window).map((c): CellView => ({
          weighting: c.weighting,
          text: c.allowed && c.validation_mae !== null ? c.validation_mae.toFixed(1) : "too few",
          best: isBest(c),
          allowed: c.allowed,
          note: c.note,
        })),
      })),
    };
  });
}

/** The winning cell's build-up, one line a step: the feature added and the average error after it. */
export function buildUpLines(grid: Grid, featureLabel: (id: string) => string): string[] {
  return grid.build_up.map((s) => `${featureLabel(s.feature)}: ${s.validation_mae.toFixed(1)}`);
}
