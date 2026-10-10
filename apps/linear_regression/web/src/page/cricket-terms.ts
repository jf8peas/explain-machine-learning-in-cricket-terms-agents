// The "In cricket terms" section (app-specific): a short sequence of blocks, each with a title, one visual and a sentence
// or two. Every number comes from the run's facts (the wording names them in braces and code has filled them in), and
// everything is set as text. The charts are plain HTML and CSS (no library), use the page's colour tokens, keep a text
// equivalent for each, never rely on colour alone, and nothing animates. The pure helpers are exported for tests.
import { h } from "./dom";

export interface Fact { value: unknown; unit: string; display: string; meaning: string }
export interface DriverRow { feature: string; label: string; fact_id: string; effect_runs: number; display: string }
export interface Segment { kind: "training" | "check" | "test"; from: number; to: number; label: string }
export interface Block { id: string; title: string; sentences: string[]; visual: Record<string, unknown>; from_model?: string[] }
export interface CricketExplanation {
  facts: Record<string, Fact>; blocks: Block[]; order: string[];
  source: "template" | "language model"; model: string | null; fallback_reason: string | null;
}

// ---------------- pure helpers ----------------

/** The blocks in the order to show them (the order in the state, then any block it left out, in the blocks' own order). */
export function orderedBlocks(e: Pick<CricketExplanation, "blocks" | "order">): Block[] {
  const by = new Map(e.blocks.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const id of e.order) { const b = by.get(id); if (b && !seen.has(id)) { out.push(b); seen.add(id); } }
  for (const b of e.blocks) if (!seen.has(b.id)) out.push(b);
  return out;
}

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

export function yearText(s: Segment): string {
  return s.from === s.to ? `${s.label} ${s.from}` : `${s.label} ${s.from} to ${s.to}`;
}

/** Segment widths for the strip: a segment is as wide as its years, but never narrower than `minShare` of the strip. */
export function stripShares(segments: Segment[], minShare = 0.12): number[] {
  const years = segments.map((s) => s.to - s.from + 1);
  const total = years.reduce((a, b) => a + b, 0);
  const raw = years.map((y) => Math.max(minShare, y / total));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / sum);
}

export function badgeShape(goalReached: boolean): "tick" | "cross" {
  return goalReached ? "tick" : "cross";
}

// ---------------- rendering ----------------

const SVG_NS = "http://www.w3.org/2000/svg";

function badge(v: Record<string, unknown>): HTMLElement {
  const reached = v.goal_reached === true;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20"); svg.setAttribute("width", "20"); svg.setAttribute("height", "20");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS(SVG_NS, reached ? "circle" : "rect");
  if (reached) { shape.setAttribute("cx", "10"); shape.setAttribute("cy", "10"); shape.setAttribute("r", "9"); }
  else { for (const [k, x] of [["x", "1"], ["y", "1"], ["width", "18"], ["height", "18"], ["rx", "3"]]) shape.setAttribute(k, x); }
  shape.setAttribute("class", "badge-shape");
  const mark = document.createElementNS(SVG_NS, "path");
  mark.setAttribute("d", reached ? "M5.5 10.5 L8.5 13.5 L14.5 6.5" : "M6 6 L14 14 M14 6 L6 14");
  mark.setAttribute("class", "badge-mark");
  svg.append(shape, mark);
  const el = h("span", { class: `goal-badge ${reached ? "reached" : "missed"}`, "data-testid": "verdict-badge" });
  el.append(svg, String(v.badge ?? (reached ? "Goal reached" : "Goal missed")));
  return el;
}

function driversChart(rows: DriverRow[]): HTMLElement {
  const list = bars(rows);
  const chart = h("div", { class: "drivers-chart", "data-testid": "drivers-chart", "aria-hidden": "true" });
  for (const b of list) {
    const track = h("span", { class: "bar-track" });
    const zero = h("span", { class: "bar-zero" });
    const bar = h("span", { class: `bar ${b.sign}` });
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

function yearsStrip(segments: Segment[]): HTMLElement {
  const shares = stripShares(segments);
  const strip = h("div", { class: "years-strip", "data-testid": "years-strip", "aria-hidden": "true" });
  segments.forEach((s, i) => {
    const el = h("span", { class: `year-seg ${s.kind}` }, h("span", { class: "year-kind" }, s.label),
      h("span", { class: "year-range" }, s.from === s.to ? String(s.from) : `${s.from}–${s.to}`));
    el.style.flexGrow = String(shares[i]);
    strip.append(el);
  });
  const list = h("ul", { "data-testid": "years-table" }, ...segments.map((s) => h("li", {}, yearText(s))));
  const wrap = h("div", { class: "years" });
  wrap.append(strip, h("div", { class: "visually-hidden" }, list));
  return wrap;
}

function visual(b: Block): HTMLElement | null {
  const v = b.visual ?? {};
  if (b.id === "verdict") return badge(v);
  if (b.id === "drivers" && Array.isArray(v.rows)) return driversChart(v.rows as DriverRow[]);
  if (b.id === "wicket" && v.figure !== undefined) {
    return h("div", { class: "big-figure", "data-testid": "wicket-figure" },
      h("span", { class: "big" }, String(v.figure)), h("span", { class: "cap" }, `${v.unit ?? "runs"}`));
  }
  if (b.id === "how_chosen" && Array.isArray(v.segments)) return yearsStrip(v.segments as Segment[]);
  return null;
}

/** The whole section, as one element to place in the final test tab. */
export function buildCricketTerms(e: CricketExplanation): HTMLElement {
  const parts: Node[] = [h("h3", {}, "In cricket terms")];
  if (e.source === "language model") {
    parts.push(h("p", { class: "writer-label", "data-testid": "writer-label" },
      h("span", { class: "tag" }, `Wording written by the language model${e.model ? ` (${e.model})` : ""}; every number is filled in by code.`)));
  } else if (e.fallback_reason) {
    parts.push(h("p", { class: "writer-fallback muted", "data-testid": "writer-fallback" }, e.fallback_reason));
  }
  for (const b of orderedBlocks(e)) {
    const block = h("section", { class: `cricket-block block-${b.id}`, "data-testid": "cricket-block", "data-block": b.id });
    block.append(h("h4", {}, b.title));
    const vis = visual(b);
    if (vis) block.append(vis);
    for (const s of b.sentences) block.append(h("p", { class: "block-sentence" }, s));
    parts.push(block);
  }
  return h("div", { "data-testid": "explanation" }, ...parts);
}
