// The introduction's reference block (app-specific): fetches /api/reference and shows the goal and how well the two
// references did on the training years. Every figure and every sentence comes from the server; nothing is typed here.
// All of it goes in as text.
import { fmt, h } from "./dom";

export interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
export interface MethodDef { id: string; name: string; note: string; marker: string }
export interface Reference {
  goal: { reference: string; margin_runs: number; text: string };
  methods: MethodDef[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: Record<string, Figures> | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: "clearly_better" | "slightly_better" | "no_better" | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  message: string | null;
}

const ROWS = ["know_nothing", "broadcaster"];
// [column key, heading, what it is called technically (shown on hover)]
const COLUMNS: [string, string, string][] = [
  ["average_miss", "Average miss", "mean absolute error"],
  ["within_10", "Within 10 runs", "hit rate"],
  ["within_20", "Within 20 runs", "hit rate"],
  ["miss_percent", "Miss as % of total", "relative error"],
  ["bias", "Bias", "mean signed error"],
];

function table(ref: Reference): HTMLElement {
  const figures = ref.figures!;
  const head = h("tr", {}, h("th", { scope: "col" }, "Method"),
    ...COLUMNS.map(([, label, tech]) => h("th", { scope: "col", title: tech }, label)));
  const body = ROWS.map((id) => {
    const f = figures[id];
    const name = ref.methods.find((m) => m.id === id)?.name ?? id;
    const cells: Record<string, string> = {
      average_miss: fmt(f.average_miss), within_10: `${fmt(f.within_10)}%`, within_20: `${fmt(f.within_20)}%`,
      miss_percent: `${fmt(f.miss_percent)}%`, bias: ref.words?.[id]?.bias_short ?? fmt(f.bias),
    };
    return h("tr", { "data-testid": "reference-row", "data-method": id },
      h("th", { scope: "row" }, name),
      ...COLUMNS.map(([key]) => h("td", { "data-col": key }, cells[key])));
  });
  const caption = h("caption", { class: "sr-only" }, "How the two references did against actual final totals in past seasons");
  return h("div", { class: "table-scroll" },
    h("table", { class: "reference-table", "data-testid": "reference-table" }, caption, h("thead", {}, head), h("tbody", {}, ...body)));
}

function render(goalEl: HTMLElement, target: HTMLElement, ref: Reference): void {
  goalEl.replaceChildren(h("strong", {}, "The goal:"), ` ${ref.goal.text}`);
  goalEl.hidden = false;
  if (!ref.figures || !ref.sentences) {
    target.replaceChildren(h("p", { class: "reference-error", "data-testid": "reference-error" },
      ref.message ?? "The accuracy figures could not be loaded."));
    return;
  }
  const s = ref.sentences;
  // plainly, whatever the finding: when the projection is only slightly better than, or no better than, knowing
  // nothing, say so before the gap
  const note = ref.finding === "clearly_better" ? s.gap : `${s.finding} ${s.gap}`;
  target.replaceChildren(
    h("p", { class: "reference-lead", "data-testid": "reference-lead" }, s.headline),
    table(ref),
    h("p", { class: "reference-note", "data-testid": "reference-note" }, note));
}

export async function setupReference(goalEl: HTMLElement, target: HTMLElement): Promise<void> {
  try {
    const res = await fetch("/api/reference");
    if (!res.ok) throw new Error(String(res.status));
    render(goalEl, target, (await res.json()) as Reference);
  } catch {
    goalEl.hidden = true;     // the goal exists only on the server, so without it there is nothing honest to show
    target.replaceChildren(h("p", { class: "reference-error", "data-testid": "reference-error" },
      "The goal and the accuracy figures could not be loaded."));
  }
}
