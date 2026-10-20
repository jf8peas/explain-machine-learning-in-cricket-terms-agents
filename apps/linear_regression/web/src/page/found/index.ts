// What the agent found (app-specific): the composer. It builds six numbered sections from the run state at the step on
// display, each from its own small module, so the tab fills in step by step as the replay advances. Everything is inserted
// as text; the language model's words are never interpreted as HTML. The tab's h2 sits in the page; the lead is here.
import { loadedCatalogue } from "../catalogue";
import { h } from "../dom";
import { examBanner, examYears, yearsText } from "../exam";
import { renderContest, type Counts } from "./contest";
import { renderGrid } from "./grid";
import { renderRace } from "./race";
import { renderRanking } from "./ranking";
import { renderRounds } from "./rounds";
import { renderSeasons } from "./seasons";
import { buildView } from "./view";

function section(n: number, title: string, ...content: Node[]): HTMLElement {
  return h("section", { class: "found-section", "data-testid": `found-section-${n}` }, h("h3", {}, `${n}. ${title}`), ...content);
}

/** The counts the contest cards state, from the catalogue once it has loaded. */
export function loadedCounts(): Counts {
  const c = loadedCatalogue();
  return { roundCap: c?.round_cap, combinations: c?.grid_combinations };
}

export function renderFound(target: HTMLElement, state: Record<string, unknown>, counts: Counts = loadedCounts()): void {
  const hasAnything = ((state.attempts as unknown[] | undefined) ?? []).length || ((state.rounds as unknown[] | undefined) ?? []).length || state.final;
  if (!hasAnything) {
    target.replaceChildren();                       // nothing yet: the tab's "not ready" sentence says so
    return;
  }
  const view = buildView(state);
  const years = examYears(view.split);
  target.replaceChildren(
    h("p", { class: "found-lead", "data-testid": "found-header" },
      "Two methods competed to pick the best clues for the prediction. One thinks like an analyst, the other searches like a machine. " +
      "This is how each one searched, and which candidate model goes forward to the final test."),
    ...(years ? [examBanner("validation", "Every score on this tab comes from the ", h("strong", {}, `check seasons, ${yearsText(years)}`),
      " (cross-validation). They are used to ", h("strong", {}, "choose"), " a candidate model, not to judge it. The honest verdict comes from the final test.")] : []),
    section(1, "The contest: two ways to choose the clues", ...renderContest(view, counts, state.model_name as string | null | undefined)),
    section(2, "How every candidate model is scored: three check seasons (cross-validation)", ...renderSeasons(view.split)),
    section(3, "The race on the check seasons", ...renderRace(view)),
    section(4, "The AI's rounds: what it tried, why, and how it went", ...renderRounds(view)),
    section(5, "The rival's grid search: trying every combination", ...renderGrid(view)),
    section(6, "Every candidate model tried, ranked", ...renderRanking(view)),
    h("p", { class: "found-next", "data-testid": "found-next" }, h("a", { href: "#final-test", "data-testid": "to-final-bottom" }, "Next: see how the chosen candidate model does on the Hold-Out Test →")));
}
