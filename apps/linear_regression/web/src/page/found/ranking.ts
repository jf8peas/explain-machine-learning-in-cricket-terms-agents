// Section 6 of What the agent found: every idea tried, ranked by average miss (app-specific). The agent's tries and the brute-force search's
// best from each allowed grid cell; the order and the tie rule are worked out in view.ts. No per-season column.
import { labelFor, menuLabel } from "../catalogue";
import { h } from "../dom";
import { cap, introducer, term, type Introducer } from "../terms";
import { setupChips } from "../setup";
import { fromTenths, type FoundView } from "./view";

export function renderRanking(view: FoundView, intro: Introducer = introducer()): Node[] {
  const out: Node[] = [h("p", { class: "found-lead-text" },
    `Every ${intro("idea")} tried: the ${intro("agent")}'s tries and the ${intro("brute_force")}'s best from each cell of its grid, in one list, ordered by average miss across the ${intro("check_seasons")}.`)];
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
      h("td", { class: `found-by found-by-${r.foundBy}` }, r.foundBy === "ai" ? cap(term("agent")) : cap(term("brute_force"))),
      h("td", { class: "rank-miss" }, fromTenths(r.miss))));
  }
  const table = h("table", { class: "attempts ranking", "data-testid": "ranking" },
    h("thead", {}, h("tr", {}, ...["#", cap(term("idea")), "Found by", `Average miss on ${term("check_seasons")} (runs)`].map((t) => h("th", { scope: "col" }, t)))), body);
  out.push(h("div", { class: "table-scroll" }, table));
  if (view.tv !== null) out.push(h("p", { class: "small", "data-testid": "ranking-tv" }, `The ${term("tv")} missed by ${fromTenths(view.tv)} on the same ${term("check_seasons")}.`));
  return out;
}
