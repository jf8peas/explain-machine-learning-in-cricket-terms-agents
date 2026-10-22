// Fixture run states for the final test tab tests: the `final` and `explanation` parts of a run, as the replay reports them.
import type { Block, CricketExplanation, Fact, FinalState } from "../../src/page/final/types";

export type Fig = { average_miss: number; within_10: number; within_20: number; bias: number };

const fig = (f: Fig) => ({ n: 214, miss_percent: 12, ...f });
const phrase = (bias: number) => (Math.abs(bias) < 0.05 ? "guesses about right on average"
  : `guesses ${Math.abs(bias).toFixed(1)} runs too ${bias > 0 ? "high" : "low"} on average`);

/** An ordinary spread of four methods: the rival's model leads, then the AI's, the broadcaster and the know-nothing guess. */
export const ordinary: Record<string, Fig> = {
  know_nothing: { average_miss: 30.4, within_10: 22.0, within_20: 44.2, bias: 0.0 },
  broadcaster: { average_miss: 21.4, within_10: 31.5, within_20: 58.6, bias: -12.2 },
  llm: { average_miss: 18.6, within_10: 33.6, within_20: 65.4, bias: -1.4 },
  forward: { average_miss: 17.9, within_10: 35.0, within_20: 66.7, bias: -0.9 },
};

export function finalState(figs: Record<string, Fig> = ordinary, winner: "llm" | "forward" = "forward",
  validation: { llm: number | null; forward: number | null } = { llm: 17.4, forward: 17.0 }): FinalState {
  const methods = ["know_nothing", "broadcaster", "llm", "forward"].filter((m) => figs[m]);
  return {
    winner, llm_took_part: "llm" in figs, methods,
    accuracy: Object.fromEntries(methods.map((m) => [m, fig(figs[m])])),
    bias_phrases: Object.fromEntries(methods.map((m) => [m, phrase(figs[m].bias)])),
    validation_mae: "llm" in figs ? validation : { llm: null, forward: validation.forward },
  };
}

/** The design's run: validation rival 17.0, AI 17.4; test 2026 AI 17.7, rival 17.8, broadcaster 21.4, know-nothing 34.5. */
export const designFigs: Record<string, Fig> = {
  know_nothing: { average_miss: 34.5, within_10: 22.0, within_20: 40.0, bias: -20.0 },
  broadcaster: { average_miss: 21.4, within_10: 31.5, within_20: 58.6, bias: -7.2 },
  llm: { average_miss: 17.7, within_10: 34.0, within_20: 66.0, bias: -4.0 },
  forward: { average_miss: 17.8, within_10: 37.0, within_20: 64.0, bias: -1.1 },
};

/** A whole run state (what the replay reports at the end of a run) for the examView and copy tests. */
export function examState(opts: { figs?: Record<string, Fig>; winner?: "llm" | "forward"; validation?: { llm: number | null; forward: number | null };
  aiAttempts?: number; allowedCells?: number; notAllowedCells?: number } = {}): Record<string, unknown> {
  const { figs = designFigs, winner = "forward", validation = { llm: 17.4, forward: 17.0 }, aiAttempts = 5, allowedCells = 24, notAllowedCells = 3 } = opts;
  const attempts = Array.from({ length: aiAttempts }, (_, i) => ({ proposer: "llm", round: i + 1, validation_mae: 17.4 + i, features: ["runs_at_10"], improved: false }));
  const cells = [
    ...Array.from({ length: allowedCells }, () => ({ allowed: true, validation_mae: 17.0 })),
    ...Array.from({ length: notAllowedCells }, () => ({ allowed: false, validation_mae: null })),
  ];
  return {
    split: { first_year: 2005, checks: [{ year: 2023 }, { year: 2024 }, { year: 2025 }], test_year: 2026 },
    final: finalState(figs, winner, validation), attempts, grid: { cells },
  };
}

export const fact = (display: string, value: unknown = display): Fact => ({ value, unit: "text", display, meaning: "m" });

export function explanation(facts: Record<string, Fact> = {}, blocks: Block[] = [], source: "template" | "language model" = "template",
  model: string | null = null): CricketExplanation {
  return {
    facts: { within_runs_threshold: fact("10"), share_within_10_words: fact("only about a third of the time"), tv_bias_large: fact("yes", true),
      ...facts }, blocks, order: blocks.map((b) => b.id), source, model, fallback_reason: null,
  };
}

export const verdictBlock = (variant: "reached" | "missed_beat" | "missed_worse"): Block => ({
  id: "verdict", title: variant === "reached" ? "Goal reached" : "Goal missed",
  sentences: ["The rival's model beat the broadcaster's projection by 3.5 runs on average."],
  visual: { variant, shape: variant === "reached" ? "tick" : variant === "missed_beat" ? "dash" : "cross" }, from_model: [],
});

export const takeawayBlocks = (): Block[] => [
  { id: "takeaway_run_rate", title: "The run rate alone is a real help", sentences: ["The broadcaster misses by 21.4 runs."], visual: {}, from_model: [] },
  { id: "takeaway_drivers", title: "A lost wicket costs about 7.0 runs", sentences: ["Each wicket costs 7.0 runs.", "Runs at 10 moves it most."],
    visual: { rows: [
      { feature: "wickets_at_10", label: "wickets lost", fact_id: "e1", effect_runs: -7.0, display: "7.0" },
      { feature: "runs_at_10", label: "runs at 10 overs", fact_id: "e2", effect_runs: 28.8, display: "28.8" },
    ], wicket: null }, from_model: [] },
  { id: "takeaway_tv", title: "Sides speed up, and the broadcaster forgets it", sentences: ["The broadcaster guesses 12.2 runs too low."], visual: {}, from_model: [] },
  { id: "rule_of_thumb", title: "A rule of thumb for watching", sentences: ["When the broadcaster shows a projected score, add about 12.2 runs."], visual: {}, from_model: [] },
];
