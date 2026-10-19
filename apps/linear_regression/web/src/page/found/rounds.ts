// Section 4 of What the agent found: one card for each round, joining what the AI proposed, why (in its own words) and how
// it went (app-specific). The reason is set as text, never as HTML. Scores and drops come from view.ts.
import { labelFor, menuLabel } from "../catalogue";
import { h } from "../dom";
import { setupChips } from "../setup";
import { fromTenths, type FoundView, type RoundView } from "./view";

const names = (ids: string[]) => ids.map(labelFor).join(", ");

function proposal(r: RoundView): HTMLElement {
  const box = h("div", { class: "round-body" });
  let clues: Node;
  if (!r.features.length) clues = h("strong", {}, "No clues proposed");
  else if (r.change === "same") clues = h("strong", {}, "Same clues");
  else if (r.change === "added") clues = h("strong", {}, `+ ${names(r.added)}`);
  else clues = h("strong", {}, names(r.features));
  const chips = setupChips({ features: r.features, window: r.window, weighting: r.weighting, training_innings: r.training_innings }, menuLabel);
  box.append(h("p", { class: "round-setup" }, clues,
    ...(chips.length ? [h("ul", { class: "setup-chips" }, ...chips.map((c) =>
      h("li", { class: "setup-chip", "data-testid": "setup-chip", "data-part": c.part }, c.text)))] : [])));
  if (r.reason) box.append(h("blockquote", { class: "reason", "data-testid": "model-reason" }, r.reason));   // the AI's words, verbatim
  return box;
}

function result(r: RoundView): HTMLElement {
  const box = h("div", { class: "round-result" });
  if (r.kind === "fitted") {
    const note = r.improved
      ? (r.firstScore ? "first score" : `${r.isBest ? "best of the run" : "new best"} ▼${fromTenths(r.drop ?? 0)}`)
      : "no better";
    box.append(h("strong", { class: "round-miss" }, fromTenths(r.miss as number)), h("span", {}, note));
  } else if (r.kind === "pending") {
    box.append(h("strong", {}, "accepted"), h("span", {}, "being scored"));
  } else if (r.kind === "rejected") {
    box.append(h("strong", {}, "✕ Rejected"), h("span", {}, r.message));
  } else if (r.kind === "finished") {
    box.append(h("strong", {}, "stopped"), h("span", {}, "the AI said it was finished"));
  } else {
    box.append(h("strong", {}, "failed"), h("span", {}, r.message));
  }
  return box;
}

export function renderRounds(view: FoundView): Node[] {
  const lead = h("p", { class: "found-lead-text" },
    "Each round, the AI proposes a candidate model and explains its thinking in its own words. Code then checks it, fits it and scores it on the check seasons.");
  if (view.fallback && !view.rounds.length) {
    return [h("p", { class: "found-lead-text", "data-testid": "rounds-none" }, "The AI made no proposals in this run, so there are no rounds to show.")];
  }
  const list = h("ol", { class: "round-list", "data-testid": "rounds" });
  for (const r of view.rounds) {
    list.append(h("li", { class: `round-card round-${r.kind}${r.isBest ? " round-best" : ""}`, "data-testid": "round-item", "data-outcome": r.kind === "fitted" ? "fit" : r.kind },
      h("span", { class: "round-number" }, `Round ${r.round}`), proposal(r), result(r)));
  }
  return [lead, ...(view.rounds.length ? [list] : []),
    h("p", { class: "small" }, "The AI's words are shown exactly as it wrote them. Scores are average misses across the three check seasons, worked out by code.")];
}
