// The hero (feature 022, app-specific): the question and the goal, not a result. A dark band with the kicker, the question, the lead,
// one button that starts the experiment, the goal card and a Commentary panel (how good the broadcaster's projection is on past innings, why a season the
// agent never sees, who does what). Every number and data-dependent sentence is the server's (/api/reference); the only words typed
// here are fixed copy. Everything goes in as text, never as markup.
import { h, fmt } from "./dom";
import { renderGoalCard, showResultStrip, type GoalCard } from "./goal-card";
import type { ResultStrip } from "./headlines";
import { UNAVAILABLE } from "./reference";
import type { Reference } from "./reference-types";
import { definition, hasTerms, NOT_AVAILABLE, term } from "./terms";

// Without the server's words (its reference could not be loaded) the page still asks its question, with a plain "agent" and "the projected score".
export const kicker = (): string => (hasTerms() ? `An ${term("agent")} experiment` : "An agent experiment").toUpperCase();
export const question = (): string => {
  const score = hasTerms() ? definition("projected_score") : NOT_AVAILABLE;
  return `Can ${hasTerms() ? `an ${term("agent")}` : "an agent"} build a regression model that beats ${score === NOT_AVAILABLE ? "the projected score" : score}?`;
};
export const LEAD = "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it's tested on a season it has never seen.";
export const START_LABEL = "▶ Start the experiment";
export const whoDoesWhat = (): string => `The ${term("agent")} chooses the ${term("clues")}; code does the rest.`;

/** The sentence as text and <strong> pieces: each phrase in `bold` is emphasised wherever it appears. Pure on its input. */
export function emphasised(text: string, bold: string[]): (Node | string)[] {
  const phrases = bold.filter((p) => p && text.includes(p));
  if (!phrases.length) return [text];
  const pattern = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return text.split(pattern).filter((part) => part !== "").map((part) => {
    if (!phrases.includes(part)) return part;
    const strong = document.createElement("strong");
    strong.textContent = part;
    return strong;
  });
}

function commentary(ref: Reference | null): HTMLElement {
  const panel = h("div", { "data-region": "commentary", class: "commentary", id: "hero-commentary", "data-testid": "hero-commentary" },
    h("span", { class: "commentary-label" }, "Commentary"));
  if (!ref || !ref.figures || !ref.hero || !ref.training) {
    panel.append(h("p", { "data-testid": "hero-unavailable", role: "status" }, ref?.message ?? UNAVAILABLE));
  } else {
    panel.append(
      h("div", { class: "tv-figures" },
        h("div", { class: "tv-figure" }, h("span", { class: "num", "data-testid": "tv-miss" }, fmt(ref.figures.broadcaster.average_miss)),
          h("span", { class: "what" }, `${term("tv")}, average miss`)),
        h("div", { class: "tv-figure" }, h("span", { class: "num", "data-testid": "nothing-miss" }, fmt(ref.figures.know_nothing.average_miss)),
          h("span", { class: "what" }, `${term("average_total")}, average miss`))),
      h("p", { class: "tv-sentence", "data-testid": "tv-sentence" }, ...emphasised(ref.hero.panel, ref.hero.panel_emphasis)),
      h("p", { class: "tv-footnote", "data-testid": "tv-footnote" }, ref.hero.footnote));
  }
  const year = ref?.test?.year;
  panel.append(
    h("p", { "data-testid": "why-unseen" }, h("strong", {}, `Why a season it never sees: `),
      `Any model looks good on the data it chose from. ${year ?? `The ${term("test_season")}`} stays locked until the agent has picked its model, then it is used once.`),
    h("p", { "data-testid": "who-does-what" }, h("strong", {}, "Who does what: "), whoDoesWhat()));
  return panel;
}

export interface Hero {
  /** Show the result strip at the foot of the goal card, or take it away. */
  setStrip(strip: ResultStrip | null): void;
}

/** Fill the hero from /api/reference. `onStart` takes the reader to the player (the button's click). */
export function renderHero(root: HTMLElement, ref: Reference | null, onStart: () => void): Hero {
  const card = renderGoalCard((ref?.goal_card as GoalCard | undefined) ?? null);
  const start = h("a", { class: "btn filled start", href: "#watch", "data-testid": "start-experiment" }, START_LABEL);
  start.addEventListener("click", (ev) => {
    // The link says where it goes (#watch), but following it would blur whatever is focused: the page moves there itself, then focuses the picker.
    ev.preventDefault();
    if (location.hash !== "#watch") history.pushState(null, "", "#watch");
    onStart();
  });
  root.replaceChildren(h("div", { class: "hero-inner" },
    h("p", { class: "kicker", "data-testid": "hero-kicker" }, kicker()),
    h("h1", { id: "hero-title", "data-testid": "hero-title" }, question()),
    card,
    h("p", { class: "hero-lead", "data-testid": "hero-lead" }, LEAD),
    h("p", { class: "hero-links", "data-testid": "hero-links" }, start),
    commentary(ref)));
  return { setStrip: (strip) => showResultStrip(card, strip) };
}
