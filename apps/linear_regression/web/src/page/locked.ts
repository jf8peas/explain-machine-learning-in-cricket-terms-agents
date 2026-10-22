// The locked cards (feature 022, app-specific): what the verdict and "Your turn" show until a run has reached its final test. A dashed
// card with a lock icon, a heading, a sentence about the test season and, for "Your turn", a link to the player. The wording is the
// design's; the test season's year is the server's (/api/reference).
import { h } from "./dom";
import type { LockVariant } from "./run-state";
import { term } from "./terms";

export const VERDICT_TITLE: Record<"before" | "during", string> = {
  before: "Press play to see how it does.",
  during: "The result appears when the agent finishes.",
};
export const TRY_LOCKED = "Run the experiment first. Your turn uses the model the agent builds.";
export const SCORE_LOCKED = "Available after a run";

/** "The run failed: boom." becomes "boom": the sentence below adds its own wording. */
export function plainReason(reason: string | null | undefined): string {
  return (reason ?? "").replace(/^The run failed:\s*/i, "").replace(/\.\s*$/, "").trim() || "the run stopped";
}

export const verdictTitle = (variant: LockVariant, reason: string | null): string =>
  variant === "failed"
    ? `The run didn't finish: ${plainReason(reason)}. Press play to try again, or choose another AI.`
    : VERDICT_TITLE[variant];

export const testYearSentence = (year: number | null | undefined): string =>
  `${year ?? `The ${term("test_season")}`} stays locked until the agent has chosen its model. Then it is used once, to judge it against the goal.`;

const lockIcon = () => {
  const icon = h("span", { class: "lock-icon", "aria-hidden": "true" }, "🔒");
  return icon;
};

/** A locked card: the icon, a heading and a sentence, and (optionally) a link. */
export function lockedCard(opts: { id: string; testid: string; title: string; body?: string; link?: { href: string; label: string } }): HTMLElement {
  return h("div", { class: "locked-card", "data-testid": opts.testid },
    lockIcon(),
    h("div", {}, h(opts.id === "verdict-title" ? "h2" : "p", { class: "locked-title", ...(opts.id === "verdict-title" ? { id: "verdict-title", "data-testid": "verdict-title" } : {}) }, opts.title),
      ...(opts.body ? [h("p", { class: "muted locked-body" }, opts.body)] : []),
      ...(opts.link ? [h("a", { class: "btn outlined", href: opts.link.href }, opts.link.label)] : [])));
}
