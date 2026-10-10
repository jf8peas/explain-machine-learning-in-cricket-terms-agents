// The one-line summary under the graph on the Working tab: the best setup so far during a run, a sentence before any run,
// or the failure when the data could not be loaded. It names the leader the leaderboard names (leader() in leaderboard.ts).
import { fmt, h } from "./dom";
import { leader, proposerName, type Attempt } from "./leaderboard";

export type SummaryModel =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "leader"; miss: string; proposer: string; features: number };

/** What the line should say for the state at the step on display. Pure, so it can be tested without a page. */
export function summaryModel(state: Record<string, unknown>): SummaryModel {
  const error = state.data_error as string | null | undefined;
  if (error) return { kind: "error", message: error };
  const best = leader((state.attempts as Attempt[] | undefined) ?? []);
  if (!best) return { kind: "empty" };
  return { kind: "leader", miss: fmt(best.validation_mae), proposer: proposerName(best.proposer), features: best.features.length };
}

export function renderSummary(target: HTMLElement, state: Record<string, unknown>): void {
  const m = summaryModel(state);
  if (m.kind === "error") {
    target.replaceChildren(h("p", { class: "error", role: "alert", "data-testid": "data-error" }, m.message));
  } else if (m.kind === "empty") {
    target.replaceChildren(h("p", { class: "muted", "data-testid": "summary-text" },
      "Results will appear here as the agent works, and in the tabs for what it found and the final test."));
  } else {
    target.replaceChildren(h("p", { "data-testid": "summary-text" },
      `Best setup so far: an average miss of ${m.miss} runs on the check years, proposed by ${m.proposer.toLowerCase()}. `,
      h("a", { href: "#found", "data-testid": "summary-link" }, "See what the agent found")));
  }
}
