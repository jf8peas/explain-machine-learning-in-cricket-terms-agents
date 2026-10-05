// The leaderboard and the model's reasoning, built from the accumulated run state (app-specific).
import { labelFor } from "./catalogue";
import { fmt, h } from "./dom";

export interface Attempt {
  features: string[];
  proposer: "llm" | "forward_selection";
  validation_mae: number;
  validation_r2: number;
  improved: boolean;
  round: number;
}
export interface RoundNote {
  round: number;
  features: string[];
  reason: string;
  finished: boolean;
  outcome: "fit" | "rejected" | "finished" | "failed";
  message?: string;
}

const who = (p: Attempt["proposer"]) => (p === "llm" ? "Language model" : "Forward selection");
const names = (ids: string[]) => ids.map(labelFor).join(", ");

export function renderLeaderboard(attempts: Attempt[], baseline: number | undefined): HTMLElement {
  const section = h("section", { "data-testid": "leaderboard", "aria-label": "Leaderboard" });
  section.append(h("h3", {}, "Leaderboard"),
    h("p", { class: "muted" }, "Every feature set that was fitted, scored on the validation year (the average miss in runs; lower is better). Code does the fitting and the scoring, whoever proposed the set."));
  if (!attempts.length) return section;
  const body = h("tbody");
  if (baseline !== undefined) {
    body.append(h("tr", { class: "baseline" }, h("th", { scope: "row" }, "TV projected score (run rate x 20 overs)"),
      h("td", {}, "Broadcaster"), h("td", {}, fmt(baseline)), h("td", {}, "–")));
  }
  attempts.forEach((a, i) => {
    body.append(h("tr", { "data-testid": "attempt-row", "data-proposer": a.proposer },
      h("th", { scope: "row" }, `${i + 1}. ${names(a.features)}`),
      h("td", {}, who(a.proposer)),
      h("td", {}, fmt(a.validation_mae)),
      h("td", {}, a.improved ? "improved" : "no better")));
  });
  const table = h("table", { class: "attempts" },
    h("thead", {}, h("tr", {}, ...["Feature set", "Proposed by", "Validation error (runs)", "Result"].map((t) => h("th", { scope: "col" }, t)))),
    body);
  section.append(table);
  return section;
}

export function renderRounds(rounds: RoundNote[], modelName: string | null | undefined): HTMLElement | null {
  if (!rounds.length) return null;
  const section = h("section", { "data-testid": "rounds", "aria-label": "The model's reasoning" });
  section.append(h("h3", {}, modelName ? `The model's reasoning (${modelName})` : "The model's reasoning"),
    h("p", { class: "muted" }, "What the language model proposed each round, in its own words, and what the code decided about it."));
  const list = h("ol", { class: "rounds" });
  for (const r of rounds) {
    const outcome = r.outcome === "fit" ? "Accepted and fitted"
      : r.outcome === "rejected" ? `Rejected by code: ${r.message ?? ""}`
      : r.outcome === "finished" ? "The model said it is finished" : `Not used: ${r.message ?? ""}`;
    list.append(h("li", { "data-testid": "round-item", "data-outcome": r.outcome },
      h("strong", {}, r.features.length ? names(r.features) : "No features proposed"),
      h("span", { class: "tag" }, "The model's reasoning:"),
      h("blockquote", { class: "reason", "data-testid": "model-reason" }, r.reason), // the model's words, verbatim, as text
      h("span", { class: `outcome ${r.outcome}` }, outcome)));
  }
  section.append(list);
  return section;
}
