// Fixture run states for the What the agent found tests: the state at several steps of a run, as the replay reports it.
import type { Attempt, RoundNote } from "../../src/page/leaderboard";
import type { Grid, GridCell } from "../../src/page/found/view";

export const split = { test_year: 2026, test_n: 300, first_year: 2005, checks: [{ year: 2023 }, { year: 2024 }, { year: 2025 }] };

export const llmAttempt = (round: number, features: string[], mae: number, improved: boolean): Attempt => ({
  features, proposer: "llm", window: "last_10", weighting: "none", training_innings: "population",
  validation_mae: mae, validation_r2: 0.5, improved, round,
});
export const note = (round: number, outcome: RoundNote["outcome"], features: string[], extra: Partial<RoundNote> = {}): RoundNote => ({
  round, features, window: "last_10", weighting: "none", training_innings: "population", reason: `reason ${round}`,
  finished: outcome === "finished", outcome, ...extra,
});

/** Round 1 fitted (first score), round 2 adds a clue and is a new best, round 3 rejected, round 4 same clues no better,
 *  round 5 finished. */
export const aiAttempts: Attempt[] = [
  llmAttempt(1, ["runs_at_10"], 20.44, true),
  llmAttempt(2, ["runs_at_10", "sixes"], 19.56, true),
  llmAttempt(4, ["runs_at_10", "sixes"], 19.9, false),
];
export const aiRounds: RoundNote[] = [
  note(1, "fit", ["runs_at_10"]),
  note(2, "fit", ["runs_at_10", "sixes"]),
  note(3, "rejected", ["runs_at_10", "sixes", "wickets_in_hand"], { message: "wickets in hand repeats wickets lost" }),
  note(4, "fit", ["runs_at_10", "sixes"]),
  note(5, "finished", [], { reason: "that is enough" }),
];

const INNINGS = ["population", "all"], WINDOWS = ["all", "last_10", "last_5", "last_3"], WEIGHTINGS = ["none", "gentle", "strong"];
export function makeGrid(bestMae = 19.4): Grid {
  const cells: GridCell[] = [];
  let k = 0;
  for (const training_innings of INNINGS) for (const window of WINDOWS) for (const weighting of WEIGHTINGS) {
    const allowed = !(training_innings === "all" && window === "last_3" && weighting === "strong");
    cells.push({ training_innings, window, weighting, allowed, note: allowed ? null : "too few innings",
      features: ["runs_at_10"], validation_mae: allowed ? 19.4 + (k++) * 0.1 : null });
  }
  cells[0].validation_mae = bestMae;
  return { caption: "caption", cells, best: cells[0], build_up: [] };
}

export const forwardAttempt = (mae = 19.4): Attempt => ({
  features: ["runs_at_10"], proposer: "forward_selection", window: "all", weighting: "none", training_innings: "population",
  validation_mae: mae, validation_r2: 0.5, improved: true, round: 1,
});

/** The state while the AI is working, before the grid search. */
export const beforeGrid = (): Record<string, unknown> => ({
  split, llm_status: "ok", baseline_validation_mae: 21.64, rounds: aiRounds, attempts: aiAttempts,
});
/** The state after the grid search, with the winner decided. */
export const afterGrid = (winner: "llm" | "forward" = "llm", forwardMae = 19.7): Record<string, unknown> => ({
  ...beforeGrid(), grid: makeGrid(forwardMae), forward_best: forwardAttempt(forwardMae),
  attempts: [...aiAttempts, forwardAttempt(forwardMae)], llm_best: aiAttempts[1],
  validation_winner: { winner, reason: "x", chosen_on: "validation" },
});
export const noLlm = (): Record<string, unknown> => ({
  split, llm_status: "not_used", llm_failure: "The model provider is not set up.", baseline_validation_mae: 21.64,
  rounds: [],
  attempts: [forwardAttempt()], grid: makeGrid(), forward_best: forwardAttempt(),
  validation_winner: { winner: "forward", reason: "x", chosen_on: "validation" },
});
export const allRejected = (): Record<string, unknown> => ({
  split, llm_status: "ok", baseline_validation_mae: 21.64,
  rounds: [note(1, "rejected", ["a"], { message: "no" }), note(2, "finished", [], { reason: "done" })], attempts: [],
});
/** The model said it was finished before any feature set had been tried: a failed round, no AI attempt. */
export const failedFirst = (): Record<string, unknown> => ({
  ...noLlm(), llm_status: "failed", llm_failure: "The language model said it was finished before any feature set had been tried.",
  rounds: [{ round: 1, features: [], reason: "all done", finished: true, outcome: "failed", message: "finished too early" }],
});
