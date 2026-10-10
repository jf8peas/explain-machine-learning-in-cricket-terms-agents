// Results area (app-specific): reads the accumulated state the visualiser reports and builds the page from it.
// Everything is inserted as text; the language model's reason is never interpreted as HTML.
import { labelFor } from "./catalogue";
import { fmt, h } from "./dom";
import { renderAccuracy, type FinalAccuracy } from "./accuracy";
import { buildCricketTerms, type CricketExplanation } from "./cricket-terms";
import type { ChartPoints } from "./accuracy-chart";
import { renderGrid } from "./grid-view";
import type { Grid } from "./grid";
import { renderLeaderboard, renderRounds, type Attempt, type RoundNote } from "./leaderboard";
import { menuLabel } from "./catalogue";
import { setupChips } from "./setup";

interface Final {
  test_mae: { llm: number | null; forward: number | null; tv: number };
  winner: "llm" | "forward";
  winner_name: string;
  margin: number | null;
  winner_mae: number;
  beat_tv: boolean;
  cleared_margin: boolean;
  improvement: number;
  llm_took_part: boolean;
  sets: { llm?: string[]; forward?: string[] };
  setups?: Record<string, { features: string[]; window: string; weighting: string; training_innings: string }>;
  winner_reason?: string;
  verdict_sentence?: string;
}
type FinalState = Final & Partial<FinalAccuracy>;

function finalComparison(f: FinalState, explanation: CricketExplanation | undefined, failure: string | null | undefined): HTMLElement {
  const box = h("div", { class: `compare ${f.beat_tv ? "win" : "lose"}`, "data-testid": "comparison" });
  const col = (label: string, value: number | null, testid: string, note?: string) =>
    h("div", { "data-testid": testid },
      h("span", { class: "big" }, value === null ? "–" : fmt(value)),
      h("span", { class: "cap" }, label), ...(note ? [h("span", { class: "cap" }, note)] : []));
  box.append(
    ...(f.accuracy ? [col("runs: the know-nothing guess", f.accuracy.know_nothing.average_miss, "final-know-nothing")] : []),
    col("runs: the language model's choice", f.test_mae.llm, "final-llm", f.llm_took_part ? undefined : "did not take part"),
    col("runs: forward selection", f.test_mae.forward, "final-forward"),
    col("runs: the TV projection", f.test_mae.tv, "final-tv"));
  box.append(h("p", { class: "winner", "data-testid": "winner" },
    f.llm_took_part
      ? `${f.winner_name.charAt(0).toUpperCase()}${f.winner_name.slice(1)} was chosen on the three check years: ` +
        `${f.winner_reason ?? "it had the lower average error"}, before the test year was touched.`
      : `The language model did not take part${failure ? ` (${failure.replace(/\.$/, "")})` : ""}, so forward selection's set is the result.`));
  box.append(h("p", { class: "verdict", "data-testid": "verdict" },
    f.verdict_sentence ??
    (f.beat_tv ? `The winning model beat the TV projection by ${fmt(Math.abs(f.improvement))} runs.`
               : `The winning model did not beat the TV projection (${fmt(Math.abs(f.improvement))} runs worse).`)));
  return box;
}

const fields = (state: Record<string, unknown>) => ({
  attempts: (state.attempts as Attempt[] | undefined) ?? [],
  rounds: (state.rounds as RoundNote[] | undefined) ?? [],
  final: state.final as FinalState | undefined,
  expl: state.explanation as CricketExplanation | undefined,
});

/** What the agent found: the language model line and notice, the leaderboard, the grid search and the model's reasoning,
 *  and once the final test is on display a link to it. Rendered from the state at the step on display. */
export function renderFound(target: HTMLElement, state: Record<string, unknown>): void {
  const { attempts, rounds, final } = fields(state);
  const baseline = state.baseline_validation_mae as number | undefined;
  const modelName = state.model_name as string | null | undefined;
  const status = state.llm_status as string | undefined;
  const failure = state.llm_failure as string | null | undefined;

  if (!attempts.length && !rounds.length && !final) {
    target.replaceChildren();                       // nothing yet: the tab's "not ready" sentence says so
    return;
  }
  const parts: Node[] = [];
  if (modelName) parts.push(h("p", { class: "muted", "data-testid": "model-used" }, `Language model used: ${modelName}`));
  if (status === "failed" || status === "not_used") {
    const tookPart = final?.llm_took_part === true; // it had made proposals before it failed
    parts.push(h("p", { class: "notice", role: "status", "data-testid": "llm-notice" },
      tookPart
        ? `The language model stopped early${failure ? `: ${failure}` : "."} Its best set so far was kept, and forward selection carried on.`
        : `The language model did not take part in this run${failure ? `: ${failure}` : "."} Forward selection, the mechanical method, carried on alone.`));
  }
  parts.push(renderLeaderboard(attempts, baseline));
  const grid = state.grid as Grid | undefined;
  if (grid) parts.push(renderGrid(grid));
  const roundsEl = renderRounds(rounds, modelName);
  if (roundsEl) parts.push(roundsEl);
  if (final) {
    parts.push(h("p", { class: "next-link", "data-testid": "to-final" },
      h("a", { href: "#final-test" }, "See how it did in The final test")));
  }
  target.replaceChildren(...parts);
}

/** The final test: the comparison, the accuracy table and chart, the two best setups, the explanation. */
export function renderFinal(target: HTMLElement, state: Record<string, unknown>): void {
  const { final, expl } = fields(state);
  const failure = state.llm_failure as string | null | undefined;
  if (!final && !expl) {
    target.replaceChildren();
    return;
  }
  const parts: Node[] = [];
  if (final) {
    parts.push(h("h3", {}, "The final test"), finalComparison(final, expl, failure));
    if (final.accuracy && final.methods && final.method_defs) {
      parts.push(...renderAccuracy(final as FinalAccuracy, (state.split as { test_year?: number } | undefined)?.test_year,
        state.chart_points as ChartPoints | undefined));
    }
    const setupText = (key: "llm" | "forward") => {
      const s = final.setups?.[key];
      return s ? ` (${setupChips(s, menuLabel).map((c) => c.text).join("; ")})` : "";
    };
    if (final.sets.llm) parts.push(h("p", { class: "muted" }, `The language model's best setup: ${final.sets.llm.map(labelFor).join(", ")}${setupText("llm")}.`));
    if (final.sets.forward) parts.push(h("p", { class: "muted" }, `Forward selection's best setup: ${final.sets.forward.map(labelFor).join(", ")}${setupText("forward")}.`));
  }
  if (expl) parts.push(buildCricketTerms(expl));
  target.replaceChildren(...parts);
}
