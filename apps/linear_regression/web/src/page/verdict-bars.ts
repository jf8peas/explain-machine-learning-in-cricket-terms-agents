// The verdict's four bars (app-specific, pure then drawn): the average miss of each method on the test season, in the order the design
// gives, from zero on one scale, shorter is better. Every number is the run's displayed figure; the names are the plain ones
// the Scoreboard uses. A method that did not run (the agent, when no language model could be reached) says "not run".
import { h } from "./dom";
import { TOKEN } from "./final/view";

export type BarId = "llm" | "forward" | "broadcaster" | "know_nothing";

export const BAR_ORDER: { id: BarId; label: string }[] = [
  { id: "llm", label: "AI agent" },
  { id: "forward", label: "Brute-force search" },
  { id: "broadcaster", label: "TV projection" },
  { id: "know_nothing", label: "Average-total guess" },
];

export const NOT_RUN = "not run";

export interface BarView {
  id: BarId;
  label: string;
  /** The displayed average miss, or null when the method did not run. */
  miss: number | null;
  text: string;
  /** Length as a share of the longest bar. */
  widthPct: number;
}

export function barViews(accuracy: Record<string, { average_miss: number }> | undefined): BarView[] {
  const misses = BAR_ORDER.map((b) => accuracy?.[b.id]?.average_miss ?? null);
  const longest = Math.max(...misses.filter((m): m is number => m !== null), 0);
  return BAR_ORDER.map((b, i) => {
    const miss = misses[i];
    return { id: b.id, label: b.label, miss, text: miss === null ? NOT_RUN : miss.toFixed(1),
             widthPct: miss === null || longest <= 0 ? 0 : (miss / longest) * 100 };
  });
}

/** The caption under the bars. */
export function barCaption(innings: number | undefined, testYear: number | undefined): string {
  const set = innings === undefined ? "innings" : `${innings} innings`;
  return `Average runs off the real total, ${set}${testYear === undefined ? "" : ` from ${testYear}`}. Shorter is better.`;
}

export function renderBars(views: BarView[]): HTMLElement {
  return h("ol", { class: "vbars", "data-testid": "verdict-bars", "aria-label": "Average miss on the test season, by method" },
    ...views.map((v) => {
      const bar = h("span", { class: "vbar" });
      bar.style.width = `${v.widthPct}%`;
      bar.style.background = TOKEN[v.id] ?? "var(--accent)";
      return h("li", { class: `vrow${v.miss === null ? " not-run" : ""}`, "data-testid": "verdict-bar", "data-method": v.id },
        h("span", { class: "vname" }, v.label),
        h("span", { class: "vtrack" }, bar),
        h("span", { class: "vvalue", "data-testid": "verdict-value" }, v.text));
    }));
}
