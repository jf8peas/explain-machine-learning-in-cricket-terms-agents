// Section 3 of the final test tab (app-specific): "In cricket terms: what this tells us". Three takeaways and a rule of
// thumb. Every number and direction word is a fact's display text, filled in by code (the wording names facts in braces);
// everything is set as text. The small chart is plain HTML and CSS, keeps a text equivalent, never relies on colour
// alone, and nothing animates. The pure helpers are exported for tests.
import { h } from "../dom";
import type { Block, CricketExplanation, DriverRow } from "./types";

// ---------------- pure helpers ----------------

export interface Bar { feature: string; label: string; sign: "adds" | "costs"; display: string; signed: string; leftPct: number; widthPct: number }

/** Bars on one diverging axis: runs added extend right of the middle, runs cost extend left. The widest bar fills its
 *  side; a very small one is still drawn at least `minPct` wide, so every bar stays visible. */
export function bars(rows: DriverRow[], minPct = 2.5): Bar[] {
  const sorted = [...rows].sort((a, b) => Math.abs(b.effect_runs) - Math.abs(a.effect_runs));
  const max = Math.max(...sorted.map((r) => Math.abs(r.effect_runs)), 1e-9);
  const hasNeg = sorted.some((r) => r.effect_runs < 0), hasPos = sorted.some((r) => r.effect_runs >= 0);
  const left = hasNeg && hasPos ? 50 : hasNeg ? 100 : 0;           // where the zero line sits, as a share of the track
  const room = hasNeg && hasPos ? 50 : 100;
  return sorted.map((r) => {
    const neg = r.effect_runs < 0;
    const widthPct = Math.max(minPct, (Math.abs(r.effect_runs) / max) * room);
    const sign = neg ? "costs" : "adds";
    return {
      feature: r.feature, label: r.label, sign, display: r.display, signed: `${neg ? "−" : "+"}${r.display}`,
      leftPct: neg ? left - widthPct : left, widthPct,
    };
  });
}

/** One line per bar for the text equivalent: "<name>: adds 28.8 runs" or "<name>: costs 4.0 runs". */
export function driversText(rows: DriverRow[]): string[] {
  return bars(rows).map((b) => `${b.label}: ${b.sign} ${b.display} runs`);
}

/** The label above the cards: who wrote the words. */
export function writerLabel(e: Pick<CricketExplanation, "source" | "model">): string {
  return e.source === "language model"
    ? `Written by ${e.model ?? "the language model"} · every number from code`
    : "Template wording · every number from code";
}

// ---------------- rendering ----------------

function driversChart(rows: DriverRow[]): HTMLElement {
  const list = bars(rows);
  const chart = h("div", { class: "drivers-chart", "data-testid": "drivers-chart", "aria-hidden": "true" });
  for (const b of list) {
    const track = h("span", { class: "bar-track" });
    const zero = h("span", { class: "bar-zero" });
    const bar = h("span", { class: `bar ${b.sign}`, "data-sign": b.sign });
    bar.style.left = `${b.leftPct}%`;
    bar.style.width = `${b.widthPct}%`;
    track.append(zero, bar);
    chart.append(h("div", { class: "bar-row", "data-feature": b.feature }, h("span", { class: "bar-label" }, b.label), track,
      h("span", { class: "bar-value" }, `${b.signed} runs`)));
  }
  const table = h("table", { "data-testid": "drivers-table" },
    h("caption", {}, "Runs a typical difference in each feature moves the predicted final total"),
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Feature"), h("th", { scope: "col" }, "Effect"), h("th", { scope: "col" }, "Runs"))),
    h("tbody", {}, ...list.map((b) => h("tr", {}, h("th", { scope: "row" }, b.label), h("td", {}, b.sign), h("td", {}, b.display)))));
  const wrap = h("div", { class: "drivers" });
  wrap.append(chart, h("div", { class: "visually-hidden" }, table));
  return wrap;
}

function card(b: Block, n: number): HTMLElement {
  const el = h("article", { class: `takeaway takeaway-${b.id}`, "data-testid": "takeaway", "data-block": b.id, "data-n": String(n) },
    h("p", { class: "takeaway-n" }, `Takeaway ${n}`), h("h4", {}, b.title));
  const rows = b.id === "takeaway_drivers" && Array.isArray((b.visual ?? {}).rows) ? ((b.visual as { rows: DriverRow[] }).rows) : null;
  b.sentences.forEach((s, i) => {
    el.append(h("p", { class: "takeaway-sentence" }, s));
    if (i === 0 && rows) el.append(driversChart(rows));
  });
  if (rows && b.sentences.length === 0) el.append(driversChart(rows));
  return el;
}

function ruleOfThumb(b: Block): HTMLElement {
  return h("div", { class: "rule-of-thumb", "data-testid": "rule-of-thumb" },
    h("p", { class: "rule-label" }, "Rule of thumb"), h("h4", {}, b.title),
    ...b.sentences.map((s) => h("p", { class: "rule-sentence" }, s)));
}

/** Section 3's content: the writer label, three takeaway cards and the rule of thumb. */
export function renderTakeaways(e: CricketExplanation): HTMLElement[] {
  const by = new Map(e.blocks.map((b) => [b.id, b]));
  const cards = ["takeaway_run_rate", "takeaway_drivers", "takeaway_tv"].flatMap((id, i) => by.has(id) ? [card(by.get(id)!, i + 1)] : []);
  const rule = by.get("rule_of_thumb");
  return [h("div", { class: "explanation", "data-testid": "explanation" },
    h("div", { class: "takeaways", "data-testid": "takeaways" }, ...cards),
    ...(rule ? [ruleOfThumb(rule)] : []))];
}

/** The right-hand label of section 3's heading. */
export function renderWriterLabel(e: CricketExplanation): HTMLElement {
  return h("p", { class: "writer-label", "data-testid": "writer-label", "data-source": e.source === "language model" ? "language model" : "template" },
    writerLabel(e));
}
