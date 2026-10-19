// Section 1 of What the agent found: the two contestants and why there is a rival (app-specific). The counts come from the
// catalogue (the round cap and the number of grid combinations); the copy without numbers is the design README's.
import { h } from "../dom";
import type { FoundView } from "./view";

export interface Counts { roundCap?: number; combinations?: number }

export function renderContest(view: FoundView, counts: Counts, modelName: string | null | undefined): Node[] {
  const tries = counts.roundCap === undefined ? "a language model" : `a language model · up to ${counts.roundCap} tries`;
  const combos = counts.combinations === undefined ? "plain code" : `plain code · ${counts.combinations} candidate models`;
  const ai = h("div", { class: "contest-card contest-ai", "data-testid": "contest-ai" },
    h("div", { class: "contest-head" }, h("span", { class: "contest-name" }, "The AI agent"), h("span", { class: "contest-kind" }, tries)),
    h("p", {}, h("strong", {}, "Thinks like an analyst."),
      " It reads the results so far, uses what it knows about cricket, and proposes the next candidate model to try, saying why."),
    h("p", { class: "small" }, "Code checks every proposal and does all the fitting and scoring. The AI never supplies a number."));
  if (modelName) ai.append(h("p", { class: "small", "data-testid": "model-used" }, `Language model used: ${modelName}`));
  if (view.status === "failed" || view.status === "not_used") {
    const failure = view.failure ? `: ${view.failure}` : ".";
    ai.append(h("p", { class: "contest-notice", role: "status", "data-testid": "llm-notice" },
      view.aiAttempts.length
        ? `The language model stopped early${failure} Its best candidate model so far was kept, and the rival carried on.`
        : `The language model did not take part in this run${failure} The rival carried on alone.`));
  }
  const rival = h("div", { class: "contest-card contest-rival", "data-testid": "contest-rival" },
    h("div", { class: "contest-head" }, h("span", { class: "contest-name" }, "The rival: forward selection"), h("span", { class: "contest-kind" }, combos)),
    h("p", {}, h("strong", {}, "Searches like a machine."),
      " For every combination of settings it starts with no clues, adds whichever single clue cuts the miss most, and repeats until nothing helps."),
    h("p", { class: "small" }, "No judgement, no cricket knowledge: just trying things in order."));
  return [
    h("div", { class: "contest-cards" }, ai, rival),
    h("div", { class: "contest-strip" },
      h("p", { "data-testid": "contest-why" }, h("strong", {}, "Why have a rival?"),
        " It's the yardstick. If the AI can't beat a simple mechanical search, its reasoning isn't adding anything."),
      h("p", { "data-testid": "contest-setup" }, h("strong", {}, "What's a candidate model?"),
        " The clues (features), how many past seasons to learn from, whether recent seasons count more, and which innings to learn from.")),
  ];
}
