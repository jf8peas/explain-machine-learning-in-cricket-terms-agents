// The rival's grid search on the page (app-specific): one small labelled grid for each training-innings choice, the best
// cell outlined (an outline and a heavier weight, so it does not depend on colour), and the winning cell's build-up.
// Everything is set as text; every wording comes from the server.
import { labelFor, menuLabel } from "./catalogue";
import { h } from "./dom";
import { buildUpLines, gridGroups, type Grid } from "./grid";

export function renderGrid(grid: Grid): HTMLElement {
  const section = h("section", { "data-testid": "grid", "aria-label": "The rival's grid search" });
  section.append(h("h3", {}, "The rival's grid search"),
    h("p", { class: "muted", "data-testid": "grid-caption" }, grid.caption),
    h("p", { class: "muted" }, "Each cell is the best set of features forward selection found with that window and weighting, and its " +
      "average error in runs over the three check years (lower is better)."));
  for (const group of gridGroups(grid, menuLabel)) {
    const head = h("tr", {}, h("th", { scope: "col" }, "Seasons learned from"),
      ...group.weightings.map((w) => h("th", { scope: "col" }, w.label)));
    const body = group.rows.map((row) => h("tr", {}, h("th", { scope: "row" }, row.label),
      ...row.cells.map((c) => h("td", {
        "data-testid": "grid-cell", "data-best": String(c.best), "data-weighting": c.weighting,
        class: `${c.best ? "best" : ""} ${c.allowed ? "" : "thin"}`.trim(), ...(c.note ? { title: c.note } : {}),
      }, c.text))));
    section.append(h("div", { class: "table-scroll" }, h("table", { class: "grid-table", "data-testid": "grid-table", "data-innings": group.innings },
      h("caption", {}, `Learning from: ${group.title}`), h("thead", {}, head), h("tbody", {}, ...body))));
  }
  const lines = buildUpLines(grid, labelFor);
  if (lines.length) {
    section.append(h("p", { class: "muted" }, "How the best cell's feature set was built, one feature at a time (average error after each):"),
      h("ol", { "data-testid": "grid-build-up", class: "build-up" }, ...lines.map((l) => h("li", {}, l))));
  }
  return section;
}
