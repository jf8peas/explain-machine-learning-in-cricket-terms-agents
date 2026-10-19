// Fixture run states for the final test tab tests: the `final` and `explanation` parts of a run, as the replay reports them.
import type { Block, CricketExplanation, Fact, FinalState } from "../../src/page/final/types";

export type Fig = { average_miss: number; within_10: number; within_20: number; bias: number };

const fig = (f: Fig) => ({ n: 214, miss_percent: 12, ...f });
const phrase = (bias: number) => (Math.abs(bias) < 0.05 ? "guesses about right on average"
  : `guesses ${Math.abs(bias).toFixed(1)} runs too ${bias > 0 ? "high" : "low"} on average`);

/** An ordinary spread of four methods: the rival's model leads, then the AI's, the TV and the know-nothing guess. */
export const ordinary: Record<string, Fig> = {
  know_nothing: { average_miss: 30.4, within_10: 22.0, within_20: 44.2, bias: 0.0 },
  broadcaster: { average_miss: 21.4, within_10: 31.5, within_20: 58.6, bias: -12.2 },
  llm: { average_miss: 18.6, within_10: 33.6, within_20: 65.4, bias: -1.4 },
  forward: { average_miss: 17.9, within_10: 35.0, within_20: 66.7, bias: -0.9 },
};

export function finalState(figs: Record<string, Fig> = ordinary, winner: "llm" | "forward" = "forward"): FinalState {
  const methods = ["know_nothing", "broadcaster", "llm", "forward"].filter((m) => figs[m]);
  return {
    winner, llm_took_part: "llm" in figs, methods,
    accuracy: Object.fromEntries(methods.map((m) => [m, fig(figs[m])])),
    bias_phrases: Object.fromEntries(methods.map((m) => [m, phrase(figs[m].bias)])),
  };
}

export const fact = (display: string, value: unknown = display): Fact => ({ value, unit: "text", display, meaning: "m" });

export function explanation(facts: Record<string, Fact> = {}, blocks: Block[] = [], source: "template" | "language model" = "template",
  model: string | null = null): CricketExplanation {
  return {
    facts: { within_runs_threshold: fact("10"), leader_within_10_words: fact("only about a third of the time"), tv_bias_large: fact("yes", true),
      ...facts }, blocks, order: blocks.map((b) => b.id), source, model, fallback_reason: null,
  };
}

export const verdictBlock = (variant: "reached" | "missed_beat" | "missed_worse", differs = false): Block => ({
  id: "verdict", title: variant === "reached" ? "Goal reached" : "Goal missed",
  sentences: ["The rival's model beat the TV projection by 3.5 runs on average.", ...(differs ? ["The AI agent's model had the shortest bar."] : [])],
  visual: { variant, shape: variant === "reached" ? "tick" : variant === "missed_beat" ? "dash" : "cross", race_leader_differs: differs }, from_model: [],
});

export const takeawayBlocks = (): Block[] => [
  { id: "takeaway_run_rate", title: "The run rate alone is a real help", sentences: ["The TV misses by 21.4 runs."], visual: {}, from_model: [] },
  { id: "takeaway_drivers", title: "A lost wicket costs about 7.0 runs", sentences: ["Each wicket costs 7.0 runs.", "Runs at 10 moves it most."],
    visual: { rows: [
      { feature: "wickets_at_10", label: "wickets lost", fact_id: "e1", effect_runs: -7.0, display: "7.0" },
      { feature: "runs_at_10", label: "runs at 10 overs", fact_id: "e2", effect_runs: 28.8, display: "28.8" },
    ], wicket: null }, from_model: [] },
  { id: "takeaway_tv", title: "Sides speed up, and the TV forgets it", sentences: ["The TV guesses 12.2 runs too low."], visual: {}, from_model: [] },
  { id: "rule_of_thumb", title: "A rule of thumb for watching", sentences: ["When the TV shows a projected score, add about 12.2 runs."], visual: {}, from_model: [] },
];
