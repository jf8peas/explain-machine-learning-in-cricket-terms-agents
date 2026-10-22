// The problem (app-specific): what the TV projection does and how far out it usually is, with one real innings as three tiles.
// The run-by-over chart with the zoom on the finish sits in Commentary. Every number comes from /api/reference; the only words
// typed here are fixed copy.
import { h, fmt } from "./dom";
import { cap, term } from "./terms";
import type { Reference } from "./reference-types";
import { mountWorm } from "./worm";

export const KICKER = "THE PROBLEM";
export const RULE_NOTE = "It just multiplies the run rate by 20.";
export const UNAVAILABLE = "The figures for this section could not be loaded.";

export function headline(usualMiss: number): string {
  return `The ${term("tv")} is usually about ${fmt(usualMiss)} runs out.`;
}

export function question(innings: number): string {
  return `${RULE_NOTE} Can an agent, left to itself, learn something smarter from ${innings.toLocaleString("en-GB")} past innings?`;
}

export function renderProblem(root: HTMLElement, ref: Reference | null): void {
  if (!ref || !ref.figures || !ref.training) {
    root.replaceChildren(h("p", { class: "kicker" }, KICKER), h("h2", { id: "problem-title" }, `The ${term("tv")}`),
      h("p", { class: "muted", "data-testid": "problem-unavailable", role: "status" }, ref?.message ?? UNAVAILABLE));
    return;
  }
  const { example, hero } = ref;
  const tiles = example
    ? h("ul", { class: "tiles", "data-testid": "problem-tiles" },
        tile("Score after 10 overs", `${example.runs_at_10}/${example.wickets_at_10}`, "score-at-10"),
        tile("What the TV said", String(example.tv_projection), "tv-said"),
        tile("The final total", String(example.final_total), "final-total"))
    : null;
  const caption = example
    ? h("p", { class: "cap-line visually-hidden", "data-testid": "problem-caption" }, `${example.batting_team} v ${example.bowling_team}, ${example.venue}, ${example.date_label}`)
    : null;
  const commentary = h("div", { "data-region": "commentary", class: "commentary", id: "problem-commentary", "data-testid": "problem-commentary" },
    h("span", { class: "commentary-label" }, "Commentary"));
  const figure = h("figure", { class: "worm-card", "data-testid": "worm-card" },
    h("div", { "data-testid": "worm-chart" }),
    h("details", { class: "worm-about" }, h("summary", {}, "About this chart"), h("p", { "data-testid": "worm-caption" }, hero?.caption ?? "")));
  if (example && hero?.caption && hero.chart_text && ref.average_total !== null) {
    commentary.append(figure);
    root.replaceChildren(h("p", { class: "kicker" }, KICKER), h("h2", { id: "problem-title", "data-testid": "problem-title" }, headline(ref.figures.broadcaster.average_miss)),
      h("p", { class: "lead", "data-testid": "problem-lead" }, question(ref.training.innings)), ...(tiles ? [tiles] : []), ...(caption ? [caption] : []), commentary);
    mountWorm(figure, figure.querySelector("[data-testid=worm-chart]") as HTMLElement, {
      example, averageMiss: ref.figures.broadcaster.average_miss, averageTotal: ref.average_total, chartText: hero.chart_text,
    });
  } else {
    commentary.append(h("p", { class: "muted" }, "There is no example innings to draw."));
    root.replaceChildren(h("p", { class: "kicker" }, KICKER), h("h2", { id: "problem-title", "data-testid": "problem-title" }, headline(ref.figures.broadcaster.average_miss)),
      h("p", { class: "lead", "data-testid": "problem-lead" }, question(ref.training.innings)), ...(tiles ? [tiles] : []), commentary);
  }
}

function tile(label: string, value: string, id: string): HTMLElement {
  return h("li", { class: "tile", "data-testid": `tile-${id}` }, h("span", { class: "tile-value" }, value), h("span", { class: "tile-label" }, label));
}
