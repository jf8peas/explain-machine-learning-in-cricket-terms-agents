// The hero (app-specific): the agent is the hero. A dark band with the headline, the Scoreboard card and two links, and a
// Commentary panel about how good the TV projection is, the goal and who does what. Every word that depends on the run comes from
// the server's headline set and every number from the run or /api/reference; the only words typed here are fixed copy with no
// figures. Everything goes in as text, never as markup.
import { h, fmt } from "./dom";
import type { Reference } from "./reference-types";
import { UNAVAILABLE } from "./reference";
import { cardView, type Headlines } from "./scoreboard";
import { originLine, type RunInfo } from "./run-source";
import { dayText } from "./recorded";

export const KICKER = "AN AI AGENT EXPERIMENT";
/** Shown only when no recorded run could be loaded, so no result is claimed. */
export const FALLBACK_H1 = "Can an AI agent beat the TV projection?";
export const FALLBACK_LEAD = "Halfway through a T20 innings, where will it finish? Run the agent live to find out.";
export const MISSING = "The recorded run could not be loaded. Run it live to see the agent work.";
export const WHO_DOES_WHAT = "The language model chooses the clues. Code fits the model, scores it and checks every number.";

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

function card(run: RunInfo | null): HTMLElement | null {
  const final = run?.state.final as { headlines?: Headlines; accuracy?: Record<string, { n: number }> } | undefined;
  const testYear = (run?.state.split as { test_year?: number } | undefined)?.test_year;
  const view = cardView(final?.headlines, testYear, final?.accuracy?.broadcaster?.n);
  if (!view) return null;
  return h("div", { class: "scoreboard-card", "data-testid": "scoreboard-card" },
    h("p", { class: "kicker", "data-testid": "scoreboard-kicker" }, view.kicker),
    h("div", { class: "scoreboard-numbers" },
      h("div", { class: "scoreboard-figure agent" },
        h("span", { class: "big", "data-testid": "scoreboard-agent" }, view.subject.miss),
        h("span", { class: "cap" }, view.subject.label)),
      h("div", { class: "scoreboard-figure tv" },
        h("span", { class: "big", "data-testid": "scoreboard-tv" }, view.tv.miss),
        h("span", { class: "cap" }, view.tv.label))),
    h("ul", { class: "scoreboard-facts", "data-testid": "scoreboard-facts" },
      ...view.facts.map((f) => h("li", { "data-fact": f.id }, f.text))));
}

function commentary(ref: Reference | null): HTMLElement {
  const panel = h("div", { class: "commentary", id: "hero-commentary", "data-testid": "hero-commentary" },
    h("span", { class: "commentary-label" }, "Commentary"));
  if (!ref || !ref.figures || !ref.hero || !ref.training) {
    panel.append(h("p", { "data-testid": "hero-unavailable", role: "status" }, ref?.message ?? UNAVAILABLE));
  } else {
    panel.append(
      h("div", { class: "tv-figures" },
        h("div", { class: "tv-figure" }, h("span", { class: "num", "data-testid": "tv-miss" }, fmt(ref.figures.broadcaster.average_miss)),
          h("span", { class: "what" }, "TV projection, average miss")),
        h("div", { class: "tv-figure" }, h("span", { class: "num", "data-testid": "nothing-miss" }, fmt(ref.figures.know_nothing.average_miss)),
          h("span", { class: "what" }, "average-total guess, average miss"))),
      h("p", { class: "tv-sentence", "data-testid": "tv-sentence" }, ...emphasised(ref.hero.panel, ref.hero.panel_emphasis)),
      h("p", { class: "tv-footnote", "data-testid": "tv-footnote" }, ref.hero.footnote));
  }
  panel.append(h("p", { "data-testid": "who-does-what" }, h("strong", {}, "Who does what: "), WHO_DOES_WHAT));
  return panel;
}

/** Fill the hero section for the run now showing and the reference figures. */
export function renderHero(root: HTMLElement, run: RunInfo | null, ref: Reference | null): void {
  const headlines = (run?.state.final as { headlines?: Headlines } | undefined)?.headlines;
  const scoreboard = card(run);
  root.replaceChildren(h("div", { class: "hero-inner" },
    h("p", { class: "kicker", "data-testid": "hero-kicker" }, KICKER),
    h("h1", { id: "hero-title", "data-testid": "hero-title" }, headlines?.hero_h1 ?? FALLBACK_H1),
    scoreboard ?? h("div", { class: "scoreboard-card missing", "data-testid": "scoreboard-card" },
      h("p", { "data-testid": "hero-missing", role: "status" }, MISSING)),
    h("p", { class: "hero-lead", "data-testid": "hero-lead" }, headlines?.lead ?? FALLBACK_LEAD),
    h("p", { class: "hero-links", "data-testid": "hero-links" },
      h("a", { class: "btn filled", href: "#watch", "data-testid": "link-watch" }, "Watch it work"),
      h("a", { class: "btn outlined", href: "#try", "data-testid": "link-try" }, "Try your own innings")),
    h("p", { class: "run-origin", "data-testid": "run-origin" }, originLine(run, dayText)),
    commentary(ref)));
}
