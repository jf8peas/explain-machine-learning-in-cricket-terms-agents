// What the agent found, worked out from the run state at the step on display (app-specific, pure). Every section module
// reads this view; none of them re-derives another's data. Misses are shown to one decimal, so every difference (a gap
// between the two methods, a drop between rounds) is worked out from the displayed values, in tenths of a run, and a
// reader can check it by subtraction.
import type { Attempt, RoundNote } from "../leaderboard";
import { leader } from "../leaderboard";

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
export interface Split { first_year: number; checks: { year: number }[]; test_year: number }
export interface ValidationWinner { winner: "llm" | "forward"; reason?: string }

export const SHADE_STEPS = 5;

/** Tenths of a run as shown: 12.34 and 12.3 are both 123. */
export const tenths = (x: number): number => Math.round(x * 10);
export const fromTenths = (t: number): string => (t / 10).toFixed(1);
export const shown = (x: number): string => fromTenths(tenths(x));

export type RoundKind = "fitted" | "pending" | "rejected" | "finished" | "failed";   // pending: accepted by code, not scored yet
export type ClueChange = "first" | "same" | "added" | "changed";
export interface RoundView {
  round: number;
  kind: RoundKind;
  features: string[];
  window: string | null | undefined;
  weighting: string | null | undefined;
  training_innings: string | null | undefined;
  reason: string;
  message: string;
  change: ClueChange;
  added: string[];                // the clues added to the previous fitted round's (when change is "added")
  miss: number | null;            // tenths, fitted rounds only
  improved: boolean;
  drop: number | null;            // tenths below the best before it; new bests after the first score only
  firstScore: boolean;
  isBest: boolean;
}
export interface RankingRow {
  rank: number;
  foundBy: "ai" | "rival";
  features: string[];
  window?: string;
  weighting?: string;
  training_innings?: string;
  miss: number;                   // tenths
}
export interface WinnerView {
  state: "pending" | "ai" | "rival" | "tie";
  winnerMiss: number | null;      // tenths
  otherMiss: number | null;
  gap: number | null;             // tenths, never negative
  belowDisplay: boolean;          // equal when shown, but the recorded winner is the rival
}
export interface GridCellView { text: string; allowed: boolean; note: string | null; best: boolean; step: number | null; window: string; weighting: string }
export interface GridGroup { innings: string; windows: string[]; weightings: string[]; cells: GridCellView[] }

export interface FoundView {
  rounds: RoundView[];
  aiAttempts: Attempt[];
  bestSoFar: { round: number; miss: number }[];   // tenths
  aiBest: number | null;
  rival: number | null;           // tenths, only once the grid search is on display
  tv: number | null;
  winner: WinnerView;
  fallback: boolean;              // the language model did not take part and made no attempts
  status: string | undefined;
  failure: string | null | undefined;
  split: Split | undefined;
  grid: Grid | undefined;
  groups: GridGroup[];
  ranking: RankingRow[];
  roundsUsed: number;
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function roundViews(rounds: RoundNote[], llm: Attempt[]): RoundView[] {
  const best = leader(llm);
  const views: RoundView[] = [];
  let previous: string[] | null = null;      // the previous fitted round's clues
  let bestMiss: number | null = null;        // best displayed miss before this round
  for (const r of rounds) {
    const attempt = r.outcome === "fit" ? llm.find((a) => a.round === r.round) : undefined;
    const kind: RoundKind = attempt ? "fitted"
      : r.outcome === "rejected" ? "rejected" : r.outcome === "finished" ? "finished" : r.outcome === "failed" ? "failed" : "pending";
    const features = r.features ?? [];
    let change: ClueChange = "first";
    let added: string[] = [];
    if (previous) {
      if (same(features, previous)) change = "same";
      else if (previous.every((f) => features.includes(f))) { change = "added"; added = features.filter((f) => !previous!.includes(f)); }
      else change = "changed";
    }
    const miss = attempt ? tenths(attempt.validation_mae) : null;
    const improved = !!attempt?.improved;
    views.push({
      round: r.round, kind, features, window: r.window, weighting: r.weighting, training_innings: r.training_innings,
      reason: r.reason ?? "", message: r.message ?? "", change, added, miss, improved,
      drop: improved && miss !== null && bestMiss !== null ? Math.max(0, bestMiss - miss) : null,
      firstScore: attempt !== undefined && bestMiss === null,
      isBest: attempt !== undefined && best !== null && attempt === best,
    });
    if (attempt) {
      previous = features;
      if (miss !== null && (bestMiss === null || miss < bestMiss)) bestMiss = miss;
    }
  }
  return views;
}

function winnerView(w: ValidationWinner | undefined, ai: number | null, rival: number | null): WinnerView {
  if (!w) return { state: "pending", winnerMiss: null, otherMiss: null, gap: null, belowDisplay: false };
  if (w.winner === "llm" && ai !== null) {
    const gap = rival === null ? null : rival - ai;
    return { state: gap === 0 ? "tie" : "ai", winnerMiss: ai, otherMiss: rival, gap: gap === null ? null : Math.max(0, gap), belowDisplay: false };
  }
  // The rival wins when the record says so, and also when the AI has no fitted setup that could go forward.
  const gap = ai === null || rival === null ? null : Math.max(0, ai - rival);
  return { state: "rival", winnerMiss: rival, otherMiss: ai, gap, belowDisplay: w.winner === "forward" && gap === 0 };
}

function gridGroups(grid: Grid | undefined): GridGroup[] {
  if (!grid) return [];
  const values = unique(grid.cells.filter((c) => c.allowed && c.validation_mae !== null).map((c) => c.validation_mae as number)).sort((a, b) => a - b);
  const step = (v: number) => Math.floor((values.indexOf(v) * SHADE_STEPS) / values.length);
  const isBest = (c: GridCell) => grid.best !== null && c.training_innings === grid.best.training_innings
    && c.window === grid.best.window && c.weighting === grid.best.weighting;
  const weightings = unique(grid.cells.map((c) => c.weighting));
  return unique(grid.cells.map((c) => c.training_innings)).map((innings) => {
    const mine = grid.cells.filter((c) => c.training_innings === innings);
    return {
      innings, weightings, windows: unique(mine.map((c) => c.window)),
      cells: mine.map((c): GridCellView => {
        const ok = c.allowed && c.validation_mae !== null;
        return { window: c.window, weighting: c.weighting, allowed: ok, note: c.note, best: isBest(c),
          text: ok ? shown(c.validation_mae as number) : "–", step: ok ? step(c.validation_mae as number) : null };
      }),
    };
  });
}

function rankingRows(llm: Attempt[], grid: Grid | undefined): RankingRow[] {
  const rows: (Omit<RankingRow, "rank"> & { raw: number })[] = llm.map((a) => ({
    foundBy: "ai", features: a.features, window: a.window, weighting: a.weighting, training_innings: a.training_innings,
    miss: tenths(a.validation_mae), raw: a.validation_mae }));
  for (const c of grid?.cells ?? []) {
    if (c.allowed && c.validation_mae !== null) {
      rows.push({ foundBy: "rival", features: c.features, window: c.window, weighting: c.weighting, training_innings: c.training_innings,
        miss: tenths(c.validation_mae), raw: c.validation_mae });
    }
  }
  // Ties keep the AI's tries first, then grid order. The rival's own attempt is not listed: it is the grid's best cell.
  return rows.map((r, i) => ({ r, i })).sort((a, b) => a.r.raw - b.r.raw || a.i - b.i)
    .map(({ r }, k) => ({ rank: k + 1, foundBy: r.foundBy, features: r.features, window: r.window, weighting: r.weighting,
      training_innings: r.training_innings, miss: r.miss }));
}

export function buildView(state: Record<string, unknown>): FoundView {
  const attempts = (state.attempts as Attempt[] | undefined) ?? [];
  const rounds = (state.rounds as RoundNote[] | undefined) ?? [];
  const ai = attempts.filter((a) => a.proposer === "llm");
  const grid = state.grid as Grid | undefined;
  const forward = grid ? (state.forward_best as Attempt | undefined) ?? null : null;
  const status = state.llm_status as string | undefined;
  const aiBestAttempt = leader(ai);
  const aiBest = aiBestAttempt ? tenths(aiBestAttempt.validation_mae) : null;
  const rival = forward ? tenths(forward.validation_mae) : null;
  const baseline = state.baseline_validation_mae as number | undefined;
  return {
    rounds: roundViews(rounds, ai), aiAttempts: ai,
    bestSoFar: ai.filter((a) => a.improved).map((a) => ({ round: a.round, miss: tenths(a.validation_mae) })),
    aiBest, rival, tv: baseline === undefined ? null : tenths(baseline),
    winner: winnerView(state.validation_winner as ValidationWinner | undefined, aiBest, rival),
    fallback: ai.length === 0 && (status === "not_used" || status === "failed"),
    status, failure: state.llm_failure as string | null | undefined, split: state.split as Split | undefined,
    grid, groups: gridGroups(grid), ranking: rankingRows(ai, grid),
    roundsUsed: rounds.reduce((m, r) => Math.max(m, r.round), 0),
  };
}
