// Section 6 of What the agent found: every candidate model tried, ranked by average miss (app-specific). The AI's tries and the rival's
// best from each allowed grid cell; the order and the tie rule are worked out in view.ts. No per-season column.
import { labelFor, menuLabel } from "../catalogue";
import { h } from "../dom";
import { setupChips } from "../setup";
import { fromTenths, type FoundView } from "./view";

export function renderRanking(view: FoundView): Node[] {
  const out: Node[] = [h("p", { class: "found-lead-text" },
    "The AI's tries and the rival's best from each cell of its grid, in one list, ordered by average miss across the check seasons.")];
  if (!view.ranking.length) {
    out.push(h("p", { class: "small" }, "Nothing has been scored yet."));
    return out;
  }
  const body = h("tbody");
  for (const r of view.ranking) {
    const chips = setupChips(r, menuLabel);
    body.append(h("tr", { "data-testid": "attempt-row", "data-proposer": r.foundBy === "ai" ? "llm" : "forward_selection" },
      h("td", { class: "rank-no" }, String(r.rank)),
      h("th", { scope: "row" }, h("strong", {}, r.features.map(labelFor).join(", ")),
        h("ul", { class: "setup-chips" }, ...chips.map((c) => h("li", { class: "setup-chip", "data-part": c.part }, c.text)))),
      h("td", { class: `found-by found-by-${r.foundBy}` }, r.foundBy === "ai" ? "AI agent" : "Rival"),
      h("td", { class: "rank-miss" }, fromTenths(r.miss))));
  }
  const table = h("table", { class: "attempts ranking", "data-testid": "ranking" },
    h("thead", {}, h("tr", {}, ...["#", "Candidate model", "Found by", "Average miss (runs)"].map((t) => h("th", { scope: "col" }, t)))), body);
  out.push(h("div", { class: "table-scroll" }, table));
  if (view.tv !== null) out.push(h("p", { class: "small", "data-testid": "ranking-tv" }, `The TV projection missed by ${fromTenths(view.tv)} on the same seasons.`));
  return out;
}
