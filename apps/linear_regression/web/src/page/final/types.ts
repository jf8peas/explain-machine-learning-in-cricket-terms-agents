// The shapes the final test tab reads from the run state (app-specific). The server works out every number and every
// sentence; the page only shows them.
import type { Figures } from "../reference-types";

export interface Fact { value: unknown; unit: string; display: string; meaning: string }
export interface DriverRow { feature: string; label: string; fact_id: string; effect_runs: number; display: string }
export interface WicketVisual { fact_id: string; figure: string; direction: "cost" | "gain" | "hand" | "less" }
export interface Block { id: string; title: string; sentences: string[]; visual: Record<string, unknown>; from_model?: string[] }
export interface CricketExplanation {
  facts: Record<string, Fact>; blocks: Block[]; order: string[];
  source: "template" | "language model"; model: string | null; fallback_reason: string | null;
}

/** The part of the run's `final` the tab reads. */
export interface FinalState {
  winner: "llm" | "forward";
  llm_took_part: boolean;
  methods: string[];
  accuracy: Record<string, Figures>;
  bias_phrases: Record<string, string>;
}

export type Verdict = "reached" | "missed_beat" | "missed_worse";
