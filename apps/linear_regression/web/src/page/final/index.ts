// The final test tab (app-specific): the composer. It builds four numbered sections from the run state at the step on display:
// how our pick did, why the scores differ from What the agent found, how close each method got, and what it means in cricket
// terms. The TEST banner says every score here is from the test year. The bars, our-pick card, section 2 and the closeness
// bars need only the final test; the goal verdict, the closing line and the takeaways come from the explanation, which the
// next replay step adds. Everything is inserted as text; the language model's words are never interpreted as HTML.
// The tab's h2 and its "not ready" sentence sit in the page; the lead is here.
import { examBanner } from "../exam";
import { h } from "../dom";
import { compareSentence } from "./copy";
import { renderCloseness } from "./closeness";
import { renderDiffer } from "./differ";
import { renderPick } from "./pick";
import { renderRace } from "./race";
import { renderTakeaways, renderWriterLabel } from "./takeaways";
import type { CricketExplanation, FinalState } from "./types";
import { examView, headerLead, rows } from "./view";

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
  const exam = examView(state);
  const testYear = exam?.years.test ?? (state.split as { test_year?: number } | undefined)?.test_year;
  const innings = list.length ? final.accuracy[list[0].id].n : undefined;
  const verdict = expl?.blocks.find((b) => b.id === "verdict");
  const chosen = list.find((r) => r.isChosen);
  target.replaceChildren(
    h("p", { class: "final-header-lead", "data-testid": "final-header" }, headerLead(testYear, innings, list.length)),
    ...(testYear === undefined ? [] : [examBanner("test", "Every score on this tab comes from ", h("strong", {}, String(testYear)),
      ", a season that was never used for learning, tuning or choosing. These are the ", h("strong", {}, "honest"), " numbers.")]),
    section(1, "How did our pick do?", null, ...(chosen ? [renderPick(chosen, testYear, verdict)] : []),
      ...renderRace(list, testYear, exam ? compareSentence(exam) : [])),
    ...(exam ? [section(2, "Why the scores differ from Model Selection", null, ...renderDiffer(exam))] : []),
    section(3, "How close did each one get?", null, ...renderCloseness(list, expl, testYear)),
    ...(expl ? [section(4, "In cricket terms: what this tells us", renderWriterLabel(expl), ...renderTakeaways(expl))] : []));
}
