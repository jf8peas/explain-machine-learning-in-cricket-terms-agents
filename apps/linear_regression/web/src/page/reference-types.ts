// The shapes of the /api/reference response (app-specific). The server works out every number and sentence; the page only
// shows them. Shared by the hero and by the accuracy views.
import type { TermsPayload } from "./terms";
export interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
export interface MethodDef { id: string; name: string; note: string; marker: string }
export interface Scale { min: number; max: number }
export interface Mark { id: string; label: string; value: number }
export interface Meter { scale: Scale; marks: Mark[]; caption: string; text: string }

/** The innings drawn in the hero: cumulative runs and wickets at the end of each of the 20 overs. */
export interface Example {
  match_id: string;
  batting_team: string;
  bowling_team: string;
  venue: string;
  date: string;
  date_label: string;
  runs: number[];
  wickets: number[];
  runs_at_10: number;
  wickets_at_10: number;
  final_total: number;
  tv_projection: number;
  tv_miss: number;
  wicket_overs: number[];
}

/** The hero's sentences, as the server worded them. The caption and the chart text are null without an example. */
export interface HeroText {
  caption: string | null;
  panel: string;
  panel_emphasis: string[];
  footnote: string;
  chart_text: string | null;
}

export interface Reference extends TermsPayload {
  goal: { reference: string; margin_runs: number; text: string; lead: string };
  methods: MethodDef[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: Record<string, Figures> | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: "clearly_better" | "slightly_better" | "no_better" | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  meter: Meter | null;
  average_total: number | null;
  example: Example | null;
  hero: HeroText | null;
  message: string | null;
}
