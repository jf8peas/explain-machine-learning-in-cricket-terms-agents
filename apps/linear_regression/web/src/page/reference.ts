// The introduction's reference block (app-specific): fetches /api/reference and shows the lead line, the miss meter and,
// in a closed section, the full figures for the two references. Every figure, every sentence and every label comes from
// the server; this file only turns a value into a place on the line. All of it goes in as text.
import { fmt, h } from "./dom";
import { layoutRows, position, zoneWidth, type Scale } from "./meter";

export interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
export interface MethodDef { id: string; name: string; note: string; marker: string }
export interface Mark { id: string; label: string; value: number }
export interface Meter { scale: Scale; marks: Mark[]; caption: string; text: string }
export interface Reference {
  goal: { reference: string; margin_runs: number; text: string; lead: string };
  methods: MethodDef[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: Record<string, Figures> | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: "clearly_better" | "slightly_better" | "no_better" | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  meter: Meter | null;
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

const SHAPES: Record<string, string> = { goal: "line" };

function goalLine(ref: Reference): HTMLElement {
  return h("p", { class: "meter-footer", "data-testid": "goal" }, h("strong", {}, "The goal:"), ` ${ref.goal.text}`);
}

function mark(m: Mark, pos: number, rows: ReturnType<typeof layoutRows>[string]): HTMLElement {
  return h("div", {
    class: "meter-mark", "data-testid": "meter-mark", "data-mark": m.id, "data-shape": SHAPES[m.id] ?? "dot",
    "data-row-wide": String(rows.rowWide), "data-row-xwide": String(rows.rowXWide), "data-row-narrow": String(rows.rowNarrow), "data-side-narrow": rows.sideNarrow,
    style: `left:${pos}%`,
  }, h("span", { class: "mark-name" }, m.label), h("span", { class: "mark-shape" }),
  h("span", { class: "mark-value" }, fmt(m.value)));
}

function meter(ref: Reference): HTMLElement {
  const mt = ref.meter!;
  const goalMark = mt.marks.find((m) => m.id === "goal")!;
  const placed = mt.marks.map((m) => ({ id: m.id, position: position(m.value, mt.scale) }));
  const rows = layoutRows(placed);
  const most = (key: "rowWide" | "rowXWide" | "rowNarrow") => String(Math.max(...Object.values(rows).map((r) => r[key])) + 1);
  const track = h("div", { class: "meter-track", "aria-hidden": "true", "data-rows-wide": most("rowWide"), "data-rows-xwide": most("rowXWide"), "data-rows-narrow": most("rowNarrow") },
    h("div", { class: "meter-line" }),
    h("div", { class: "meter-zone", "data-testid": "meter-zone", style: `width:${zoneWidth(goalMark.value, mt.scale)}%` }),
    ...mt.marks.map((m, i) => mark(m, placed[i].position, rows[m.id])));
  const top = h("div", { class: "meter-top", "aria-hidden": "true" },
    h("span", { class: "meter-end" }, "← better"),
    h("span", { class: "meter-caption", "data-testid": "meter-caption" }, mt.caption),
    h("span", { class: "meter-end" }, "worse →"));
  const figure = h("div", { class: "meter-figure", role: "img", "aria-label": mt.text, "data-testid": "meter-figure" }, top, track);
  return h("div", { class: "meter", "data-testid": "meter" }, figure, goalLine(ref));
}

const lead = (ref: Reference) => h("p", { class: "intro-lead", "data-testid": "intro-lead" }, ref.goal.lead);
const failure = (text: string) => h("p", { class: "reference-error", "data-testid": "reference-error" }, text);

function detail(ref: Reference): HTMLElement[] {
  const s = ref.sentences!;
  // plainly, whatever the finding: when the projection is only slightly better than, or no better than, knowing
  // nothing, say so before the gap
  const note = ref.finding === "clearly_better" ? s.gap : `${s.finding} ${s.gap}`;
  return [
    h("p", { class: "reference-lead", "data-testid": "reference-lead" }, s.headline),
    table(ref),
    h("p", { class: "reference-note", "data-testid": "reference-note" }, note),
  ];
}

function render(region: HTMLElement, details: HTMLElement, ref: Reference): void {
  const body = details.querySelector(".reference-detail") as HTMLElement;
  if (!ref.figures || !ref.sentences || !ref.meter) {
    // the lead and the goal need no figures; the meter and the table do
    region.replaceChildren(lead(ref), goalLine(ref), failure(ref.message ?? "The accuracy figures could not be loaded."));
    body.replaceChildren();
    details.hidden = true;
    return;
  }
  region.replaceChildren(lead(ref), meter(ref));
  body.replaceChildren(...detail(ref));
  details.hidden = false;
}

export async function setupReference(region: HTMLElement, details: HTMLElement): Promise<void> {
  try {
    const res = await fetch("/api/reference");
    if (!res.ok) throw new Error(String(res.status));
    render(region, details, (await res.json()) as Reference);
  } catch {
    // the goal exists only on the server, so without it there is nothing honest to show
    region.replaceChildren(failure("The goal and the accuracy figures could not be loaded."));
    details.hidden = true;
  }
}
