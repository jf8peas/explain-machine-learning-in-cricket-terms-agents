// Results area (app-specific): reads the accumulated state the visualiser reports and builds the page from it.
// Everything is inserted as text; the language model's reason is never interpreted as HTML.
import { labelFor } from "./catalogue";
import { fmt, h } from "./dom";
import { renderAccuracy, type FinalAccuracy } from "./accuracy";
import type { ChartPoints } from "./accuracy-chart";
import { renderLeaderboard, renderRounds, type Attempt, type RoundNote } from "./leaderboard";

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
  verdict_sentence?: string;
}
type FinalState = Final & Partial<FinalAccuracy>;
interface Explanation {
  sentences: string[];
  most_important: string;
  comparison: { model_mae: number; baseline_mae: number; beat_baseline: boolean; cleared_margin: boolean; improvement: number; r2: number };
}

function finalComparison(f: FinalState, explanation: Explanation | undefined, failure: string | null | undefined): HTMLElement {
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
  const verdict = explanation?.comparison;
  box.append(h("p", { class: "winner", "data-testid": "winner" },
    f.llm_took_part
      ? `${f.winner_name.charAt(0).toUpperCase()}${f.winner_name.slice(1)} won` + (f.margin ? ` by ${fmt(f.margin)} runs.` : ", on a tie.")
      : `The language model did not take part${failure ? ` (${failure.replace(/\.$/, "")})` : ""}, so forward selection's set is the result.`));
  box.append(h("p", { class: "verdict", "data-testid": "verdict" },
    f.verdict_sentence ??
    (f.beat_tv ? `The winning model beat the TV projection by ${fmt(Math.abs(verdict?.improvement ?? f.improvement))} runs.`
               : `The winning model did not beat the TV projection (${fmt(Math.abs(f.improvement))} runs worse).`)));
  return box;
}

export function renderResults(target: HTMLElement, state: Record<string, unknown>): void {
  const attempts = (state.attempts as Attempt[] | undefined) ?? [];
  const rounds = (state.rounds as RoundNote[] | undefined) ?? [];
  const final = state.final as FinalState | undefined;
  const expl = state.explanation as Explanation | undefined;
  const baseline = state.baseline_validation_mae as number | undefined;
  const dataError = state.data_error as string | null | undefined;
  const modelName = state.model_name as string | null | undefined;
  const status = state.llm_status as string | undefined;
  const failure = state.llm_failure as string | null | undefined;

  if (dataError) {
    target.replaceChildren(h("p", { class: "error", role: "alert", "data-testid": "data-error" }, dataError));
    return;
  }
  if (!attempts.length && !rounds.length && !final) {
    target.replaceChildren(h("p", { class: "muted" }, "Results appear here as the agent works. Press Play above."));
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
  const roundsEl = renderRounds(rounds, modelName);
  if (roundsEl) parts.push(roundsEl);
  if (final) {
    parts.push(h("h3", {}, "The final test"), finalComparison(final, expl, failure));
    if (final.accuracy && final.methods && final.method_defs) {
      parts.push(...renderAccuracy(final as FinalAccuracy, (state.split as { test_year?: number } | undefined)?.test_year,
        state.chart_points as ChartPoints | undefined));
    }
    if (final.sets.llm) parts.push(h("p", { class: "muted" }, `The language model's best set: ${final.sets.llm.map(labelFor).join(", ")}.`));
    if (final.sets.forward) parts.push(h("p", { class: "muted" }, `Forward selection's set: ${final.sets.forward.map(labelFor).join(", ")}.`));
  }
  if (expl) {
    parts.push(h("h3", {}, "In cricket terms"),
      h("ul", { class: "explanation", "data-testid": "explanation" }, ...expl.sentences.map((s) => h("li", {}, s))));
  }
  target.replaceChildren(...parts);
}
