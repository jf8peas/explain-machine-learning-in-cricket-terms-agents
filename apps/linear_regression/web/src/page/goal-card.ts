// The goal card on the hero, and the result strip at its foot (feature 022, app-specific). Every word is the server's: the card comes
// from /api/reference (`goal_card`), the strip from the finished run's headline set (`result_strip`). Nothing about the agent's result
// is drawn before a run has reached its final test.
import { h } from "./dom";
import type { ResultStrip } from "./headlines";

export interface GoalCard {
  kicker: string;
  sentence: string;
  tv?: { miss: number; label: string };
  target?: { runs: string; label: string };
  judged?: string;
}

/** The card's elements, from the server's words; just the kicker and the goal sentence when the figures could not be loaded. */
export function renderGoalCard(card: GoalCard | null | undefined): HTMLElement {
  const root = h("div", { class: "goal-card", "data-testid": "goal-card" });
  if (!card) {
    root.append(h("p", { class: "muted", "data-testid": "goal-unavailable", role: "status" }, "The goal could not be loaded."));
    return root;
  }
  root.append(
    h("p", { class: "goal-kicker", "data-testid": "goal-kicker" }, card.kicker),
    h("p", { class: "goal-sentence", "data-testid": "goal-sentence" }, card.sentence));
  if (card.tv && card.target) {
    root.append(h("div", { class: "goal-figures" },
      h("div", { class: "goal-figure" },
        h("span", { class: "num", "data-testid": "goal-tv-figure" }, card.tv.miss.toFixed(1)),
        h("span", { class: "what" }, card.tv.label)),
      h("div", { class: "goal-figure" },
        h("span", { class: "num", "data-testid": "goal-target-figure" }, card.target.runs),
        h("span", { class: "what" }, card.target.label))));
  }
  if (card.judged) root.append(h("p", { class: "goal-judged", "data-testid": "goal-judged" }, card.judged));
  root.append(h("div", { class: "result-slot", "data-testid": "result-slot" }));
  return root;
}

/** Put the result strip at the foot of the card, or take it away. */
export function showResultStrip(card: ParentNode, strip: ResultStrip | null): void {
  const slot = card.querySelector<HTMLElement>("[data-testid=result-slot]");
  if (!slot) return;
  if (!strip) { slot.replaceChildren(); return; }
  slot.replaceChildren(h("p", { class: "result-strip", "data-testid": "result-strip" },
    h("strong", {}, `Result: ${strip.label}.`), ` ${strip.text} `,
    h("a", { href: "#verdict", "data-testid": "result-link" }, "See the verdict ↓")));
}
