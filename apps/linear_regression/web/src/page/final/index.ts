// The final test tab (app-specific): the composer. It builds three numbered sections from the run state at the step on
// display: who won the prediction race, how close each method got, and what it means in cricket terms. The bars and bias
// words need only the final test; the verdict line, the closing line and the takeaways come from the explanation, which
// the next replay step adds. Everything is inserted as text; the language model's words are never interpreted as HTML.
// The tab's h2 and its "not ready" sentence sit in the page; the lead is here.
import { h } from "../dom";
import { renderCloseness } from "./closeness";
import { renderRace } from "./race";
import { renderTakeaways, renderWriterLabel } from "./takeaways";
import type { CricketExplanation, FinalState } from "./types";
import { headerLead, rows } from "./view";

function section(n: number, title: string, aside: Node | null, ...content: Node[]): HTMLElement {
  const head = aside
    ? h("div", { class: "final-section-head" }, h("h3", {}, `${n}. ${title}`), aside)
    : h("h3", {}, `${n}. ${title}`);
  return h("section", { class: "final-section", "data-testid": `final-section-${n}` }, head, ...content);
}

export function renderFinal(target: HTMLElement, state: Record<string, unknown>): void {
  const final = state.final as FinalState | undefined;
  if (!final || !final.accuracy || !final.methods) {
    target.replaceChildren();                       // nothing yet: the tab's "not ready" sentence says so
    return;
  }
  const expl = state.explanation as CricketExplanation | undefined;
  const list = rows(final);
  const testYear = (state.split as { test_year?: number } | undefined)?.test_year;
  const innings = list.length ? final.accuracy[list[0].id].n : undefined;
  const verdict = expl?.blocks.find((b) => b.id === "verdict");
  target.replaceChildren(
    h("p", { class: "final-header-lead", "data-testid": "final-header" }, headerLead(testYear, innings, list.length)),
    section(1, "Who won the prediction race?", null, ...renderRace(list, verdict)),
    section(2, "How close did each one get?", null, ...renderCloseness(list, expl)),
    ...(expl ? [section(3, "In cricket terms: what this tells us", renderWriterLabel(expl), ...renderTakeaways(expl))] : []));
}
