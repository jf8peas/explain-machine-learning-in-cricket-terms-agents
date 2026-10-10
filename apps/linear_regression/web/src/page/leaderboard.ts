// The leaderboard and the model's reasoning, built from the accumulated run state (app-specific).
import { labelFor, menuLabel } from "./catalogue";
import { fmt, h } from "./dom";
import { checkLabels, setupChips, type CheckError } from "./setup";

export interface Attempt {
  features: string[];
  proposer: "llm" | "forward_selection";
  window?: string;
  weighting?: string;
  training_innings?: string;
  checks?: CheckError[];
  validation_mae: number;
  validation_r2: number;
  improved: boolean;
  round: number;
}
export interface RoundNote {
  round: number;
  features: string[];
  window?: string | null;
  weighting?: string | null;
  training_innings?: string | null;
  reason: string;
  finished: boolean;
  outcome: "fit" | "rejected" | "finished" | "failed";
  message?: string;
}

const who = (p: Attempt["proposer"]) => (p === "llm" ? "Language model" : "Forward selection");
const names = (ids: string[]) => ids.map(labelFor).join(", ");

/** The parts of a setup other than its features, as small labelled chips. */
function chips(setup: Parameters<typeof setupChips>[0]): HTMLElement {
  return h("ul", { class: "setup-chips" }, ...setupChips(setup, menuLabel).map((c) =>
    h("li", { class: "setup-chip", "data-testid": "setup-chip", "data-part": c.part }, c.text)));
}

/** The attempt with the lowest average error over the check years (the earliest wins a tie): the leading setup so far.
 *  The leaderboard lists every attempt; the summary line under the graph names this one. */
export function leader(attempts: Attempt[]): Attempt | null {
  let best: Attempt | null = null;
  for (const a of attempts) if (best === null || a.validation_mae < best.validation_mae) best = a;
  return best;
}

/** Who proposed an attempt, as the leaderboard words it. */
export const proposerName = who;

export function renderLeaderboard(attempts: Attempt[], baseline: number | undefined): HTMLElement {
  const section = h("section", { "data-testid": "leaderboard", "aria-label": "Leaderboard" });
  section.append(h("h3", {}, "Leaderboard"),
    h("p", { class: "muted" }, "Every setup that was fitted, judged on three check years (the average miss in runs over the three, and each year's own miss; lower is better). Code does the fitting and the scoring, whoever proposed the setup."));
  if (!attempts.length) return section;
  const body = h("tbody");
  if (baseline !== undefined) {
    body.append(h("tr", { class: "baseline" }, h("th", { scope: "row" }, "TV projected score (run rate x 20 overs)"),
      h("td", {}, "Broadcaster"), h("td", {}, fmt(baseline)), h("td", {}, "–"), h("td", {}, "–")));
  }
  attempts.forEach((a, i) => {
    body.append(h("tr", { "data-testid": "attempt-row", "data-proposer": a.proposer },
      h("th", { scope: "row" }, `${i + 1}. ${names(a.features)}`, chips(a)),
      h("td", {}, who(a.proposer)),
      h("td", {}, fmt(a.validation_mae)),
      h("td", { class: "check-errors" }, ...(a.checks ?? []).map((c, k) =>
        h("span", { "data-testid": "check-error", "data-year": String(c.year) }, checkLabels([c])[0]))),
      h("td", {}, a.improved ? "improved" : "no better")));
  });
  const table = h("table", { class: "attempts" },
    h("thead", {}, h("tr", {}, ...["Setup", "Proposed by", "Average error (runs)", "Each check year (runs)", "Result"].map((t) => h("th", { scope: "col" }, t)))),
    body);
  section.append(h("div", { class: "table-scroll" }, table));   // scrolls inside its own box on a phone
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
      h("strong", {}, r.features.length ? names(r.features) : "No features proposed"), chips(r),
      h("span", { class: "tag" }, "The model's reasoning:"),
      h("blockquote", { class: "reason", "data-testid": "model-reason" }, r.reason), // the model's words, verbatim, as text
      h("span", { class: `outcome ${r.outcome}` }, outcome)));
  }
  section.append(list);
  return section;
}
