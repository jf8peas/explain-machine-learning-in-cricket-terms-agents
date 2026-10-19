// Section 5 of What the agent found: the rival's grid search (app-specific). One small table for each training-innings
// choice: rows are the training windows, columns the recency weightings, each cell the best average miss found with that
// combination. Shade is a stepped tint of the rival's colour by rank, but the value is always printed, and the best cell is
// outlined, bold and starred, so shade is never the only cue. Every label comes from the setup menus.
import { labelFor, menuLabel, menuShort } from "../catalogue";
import { h } from "../dom";
import { shown, type FoundView } from "./view";

export function renderGrid(view: FoundView): Node[] {
  const out: Node[] = [h("p", { class: "found-lead-text" },
    "The rival can't reason, so it tries everything. Each cell is one combination of settings, chosen before learning starts. Settings like these are called ",
    h("strong", {}, "hyperparameters"), ", and trying every combination is called a ", h("strong", {}, "grid search"),
    ". In each cell the rival adds clues one at a time, keeping whichever cuts the miss most.")];
  if (!view.grid) {
    out.push(h("p", { class: "small" }, "The rival has not searched yet."));
    return out;
  }
  const grid = view.grid;
  const wrap = h("div", { class: "grid-groups" });
  let note = 0;
  for (const group of view.groups) {
    const head = h("tr", {}, h("th", { scope: "col" }, "Seasons learned from"),
      ...group.weightings.map((w) => h("th", { scope: "col" }, menuShort("weighting", w))));
    const body = group.windows.map((window) => h("tr", {}, h("th", { scope: "row" }, menuShort("window", window)),
      ...group.weightings.map((weighting) => {
        const c = group.cells.find((x) => x.window === window && x.weighting === weighting)!;
        const attrs: Record<string, string> = { "data-testid": "grid-cell", "data-best": String(c.best), "data-weighting": weighting };
        const cell = h("td", attrs);
        if (!c.allowed) {
          cell.className = "grid-none";
          cell.append("–");
          if (c.note) {
            const id = `grid-note-${note++}`;
            cell.setAttribute("aria-describedby", id);
            cell.title = c.note;
            cell.append(h("span", { id, class: "visually-hidden" }, c.note));
          }
        } else {
          cell.className = `grid-step-${c.step}${c.best ? " grid-best" : ""}`;
          cell.append(c.best ? `★ ${c.text}` : c.text);
        }
        return cell;
      })));
    wrap.append(h("div", { class: "table-scroll" }, h("table", { class: "grid-table", "data-testid": "grid-table", "data-innings": group.innings },
      h("caption", {}, `Learning from: ${menuLabel("training_innings", group.innings)}`), h("thead", {}, head), h("tbody", {}, ...body))));
  }
  out.push(wrap);
  const best = grid.best;
  if (best && best.validation_mae !== null) {
    out.push(h("p", { class: "grid-best-line", "data-testid": "grid-best" }, h("strong", {}, `★ The rival's best: ${shown(best.validation_mae)} runs on the check seasons.`),
      ` It learned from ${menuLabel("window", best.window)}, with ${menuLabel("weighting", best.weighting)}, using ${menuLabel("training_innings", best.training_innings)}, ` +
      `with ${best.features.map(labelFor).join(", ")} as clues. Darker cells missed by less.`));
  }
  return out;
}
