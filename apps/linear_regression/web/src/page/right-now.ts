// The "Right now" card (feature 022, app-specific): the step working, what it is doing in plain words (the server's line for the node),
// the round and the best score so far. When a run stops part-way it says so and keeps the last step shown. Not a live region: it
// changes at every node, and what is spoken is the player's business.
import { h } from "./dom";
import type { RightNow } from "./run-state";

export interface RightNowCard {
  el: HTMLElement;
  render(now: RightNow): void;
}

export function buildRightNow(): RightNowCard {
  const field = (label: string, testid: string) => {
    const value = h("dd", { "data-testid": testid }, "—");
    return { row: h("div", { class: "rn-row" }, h("dt", {}, label), value), value };
  };
  const step = field("Step", "right-now-step");
  const doing = field("Doing", "right-now-doing");
  const round = field("Round", "right-now-round");
  const best = field("Best so far", "right-now-best");
  const stopped = h("p", { class: "rn-stopped", "data-testid": "right-now-stopped", hidden: "" });
  const el = h("section", { class: "right-now", "data-testid": "right-now", "aria-labelledby": "right-now-title" },
    h("h3", { id: "right-now-title" }, "Right now"),
    h("dl", {}, step.row, doing.row, round.row, best.row), stopped);
  return {
    el,
    render(now) {
      step.value.textContent = now.step;
      doing.value.textContent = now.doing;
      round.value.textContent = now.round;
      best.value.textContent = now.best;
      stopped.hidden = !now.stopped;
      stopped.textContent = now.stopped ?? "";
      el.toggleAttribute("data-stopped", !!now.stopped);
    },
  };
}
