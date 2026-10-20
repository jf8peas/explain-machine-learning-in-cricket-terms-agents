// The hero's "worm" chart (app-specific, feature 017): one real innings as a chart card with two panels. The line graph
// shows all 20 overs evenly spaced, the first 10 as grey context and the last 10 as the white prediction area; the zoom
// magnifies the totals at 20 overs, where the TV projection, the know-nothing guess and what actually happened land. Hand-built
// SVG, no library; nothing animates. Every value comes from the server (the example innings and the reference figures);
// wormPlan only turns them into places on the chart and drawWorm draws the plan. Wide: one SVG, the plot split 60/40, so
// the lens lines are drawn in the same drawing. Narrow: two SVGs, the zoom stacked under the line graph. Colours are the page's
// CSS variables, and the series are also told apart by shape, line style and label, never by colour alone.
import { fmt } from "./dom";
import type { Example } from "./reference-types";
import { layoutMode, missWords, NARROW_BELOW, spreadLabels, yAxis, zoomRange, type Mode, type YAxis, type ZoomRange } from "./worm-layout";

export type { Mode } from "./worm-layout";
export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; width: number; height: number }
export interface WormInput { example: Example; averageMiss: number; averageTotal: number; chartText: string }

const OVERS = 20, HALF = 10;
/** Where the lens boxes and joining lines are drawn relative to the zoom (wide), and the size of the pieces. */
const LABEL_GAP = 22;            // least distance between two zoom labels' baselines
const AGENT_H = 40, KEY_H = 24, FOOT_PAD = 10;

export interface LineGeometry {
  width: number; height: number; panel: number;           // panel: the line graph's share of the drawing's width
  left: number; right: number; top: number; bottom: number;
  tick: number; note: number; dot: number; head: number;
}
export interface ZoomGeometry { card: Box; top: number; label: number; small: number; title: number }

const WIDE_W = 700;
const WIDE_LINE: LineGeometry = { width: WIDE_W, height: 330, panel: 0.6 * WIDE_W, left: 38, right: 408, top: 70, bottom: 298, tick: 11, note: 11, dot: 13, head: 11 };
const WIDE_ZOOM: ZoomGeometry = { card: { x: 0.61 * WIDE_W, y: 70, width: 0.39 * WIDE_W, height: 228 }, top: 70, label: 15, small: 12, title: 11 };
const NARROW_LINE: LineGeometry = { width: 340, height: 276, panel: 340, left: 32, right: 320, top: 66, bottom: 244, tick: 10.5, note: 10.5, dot: 12, head: 10.5 };
const NARROW_ZOOM: ZoomGeometry = { card: { x: 2, y: 46, width: 336, height: 250 }, top: 46, label: 14, small: 11.5, title: 10.5 };

export const lineGeometryFor = (mode: Mode): LineGeometry => (mode === "wide" ? WIDE_LINE : NARROW_LINE);
export const zoomGeometryFor = (mode: Mode): ZoomGeometry => (mode === "wide" ? WIDE_ZOOM : NARROW_ZOOM);

export interface LinePlan {
  geometry: LineGeometry; axis: YAxis;
  overX: (over: number) => number;
  midX: number;
  context: Box; prediction: Box;
  contextLine: Pt[]; actualLast10: Pt[];
  wickets: { over: number; pt: Pt; band: "context" | "prediction" }[];
  dot: Pt; dotLabel: string;
  finishX: number; actual: Pt; tv: Pt; nothing: Pt;
  lens: { x: number; top: number; bottom: number };
  headings: { context: [string, string]; prediction: [string, string, string] };
}

export interface ZoomLabel { id: "actual" | "miss" | "tv" | "nothing"; text: string; y: number }
export interface ZoomPlan {
  geometry: ZoomGeometry; card: Box; range: ZoomRange;
  scale: (value: number) => number;
  ruler: { x: number; top: number; bottom: number; ticks: { value: number; y: number }[] };
  markers: { actual: Pt; tv: Pt; nothing: Pt };
  usualMiss: { x: number; width: number; top: number; bottom: number; from: number; to: number; text: string };
  bracket: { x: number; top: number; bottom: number; words: string; direction: "short" | "over" | "spot on" };
  labels: ZoomLabel[];
  agent: Box; key: Box;
  title: [string, string];
}

export interface Plan {
  mode: Mode;
  layout: "split" | "stacked";
  line: LinePlan; zoom: ZoomPlan;
  joins: { x1: number; y1: number; x2: number; y2: number }[];
  shares: { line: number; zoom: number };
}

// ---------------- the zoom ----------------

/** The zoom panel's places. Pure. The three predictions, the miss and its words sit on one ruler of totals at 20 overs. */
export function zoomPlan(input: WormInput, g: ZoomGeometry): ZoomPlan {
  const { example: e, averageMiss } = input;
  const actual = e.final_total, tv = e.tv_projection, nothing = Math.round(input.averageTotal);
  const range = zoomRange({ actual, tv, nothing }, averageMiss);
  const { card } = g;
  const foot = AGENT_H + KEY_H + FOOT_PAD * 3;
  const bandTop = card.y + 14, bandBottom = card.y + card.height - foot;
  const scale = (v: number) => bandBottom - ((v - range.lo) / (range.hi - range.lo)) * (bandBottom - bandTop);
  const rulerX = card.x + 40;

  const words = missWords(actual, tv);
  const direction = actual > tv ? "short" : actual < tv ? "over" : "spot on";
  const bracketX = rulerX + 28;
  const wishedMid = direction === "spot on" ? scale(tv) : (scale(actual) + scale(tv)) / 2;

  // labels: sorted by position and pushed apart so none overlap; the words of the miss sit between the two ends of the bracket
  const wished = [
    { id: "actual" as const, text: `Actual ${actual}`, y: scale(actual) + g.label * 0.35 },
    { id: "miss" as const, text: words, y: wishedMid + g.label * 0.35 },
    { id: "tv" as const, text: `TV ${tv}`, y: scale(tv) + g.label * 0.35 },
    { id: "nothing" as const, text: `Know-nothing ${nothing}`, y: scale(nothing) + g.label * 0.35 },
  ];
  const placed = spreadLabels(wished.map((w) => ({ id: w.id, y: w.y })), LABEL_GAP, bandTop + g.label * 0.8, bandBottom - 2);
  const labels = wished.map((w) => ({ ...w, y: placed[w.id] })).sort((a, b) => a.y - b.y);

  const footTop = bandBottom + FOOT_PAD;
  const agent: Box = { x: card.x + 12, y: footTop, width: card.width - 24, height: AGENT_H };
  const key: Box = { x: card.x + 12, y: footTop + AGENT_H + FOOT_PAD, width: card.width - 24, height: KEY_H };

  return {
    geometry: g, card, range, scale,
    ruler: { x: rulerX, top: scale(range.hi), bottom: scale(range.lo), ticks: range.ticks.map((value) => ({ value, y: scale(value) })) },
    markers: { actual: { x: rulerX, y: scale(actual) }, tv: { x: rulerX, y: scale(tv) }, nothing: { x: rulerX, y: scale(nothing) } },
    usualMiss: { x: rulerX + 7, width: 9, top: scale(tv + averageMiss), bottom: scale(tv - averageMiss), from: tv - averageMiss, to: tv + averageMiss,
      text: `TV's usual miss, ±${fmt(averageMiss)}` },
    bracket: { x: bracketX, top: scale(Math.max(actual, tv)), bottom: scale(Math.min(actual, tv)), words, direction },
    labels, agent, key,
    title: ["ZOOM ON THE FINISH", "total after 20 overs"],
  };
}

// ---------------- the plan ----------------

/** Where everything goes. Pure: the same input and mode always give the same plan. */
export function wormPlan(input: WormInput, mode: Mode): Plan {
  const { example: e, averageMiss, averageTotal } = input;
  const g = lineGeometryFor(mode);
  const zoom = zoomPlan(input, zoomGeometryFor(mode));
  const axis = yAxis([...e.runs, e.tv_projection + averageMiss, e.tv_projection, averageTotal]);
  const overX = (over: number) => g.left + (over / OVERS) * (g.right - g.left);
  const sy = (runs: number) => g.bottom - (runs / axis.max) * (g.bottom - g.top);
  const at = (over: number): Pt => ({ x: overX(over), y: sy(over === 0 ? 0 : e.runs[over - 1]) });
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => at(from + i));
  const midX = overX(HALF), finishX = overX(OVERS);
  const dot = at(HALF);

  const clampY = (y: number) => Math.min(g.bottom, Math.max(g.top, y));
  const lens = { x: finishX, top: clampY(sy(zoom.range.hi)), bottom: clampY(sy(zoom.range.lo)) };
  const joins = mode === "wide"
    ? [{ x1: finishX + 6, y1: lens.top, x2: zoom.card.x, y2: zoom.card.y },
       { x1: finishX + 6, y1: lens.bottom, x2: zoom.card.x, y2: zoom.card.y + zoom.card.height }]
    : [];

  const line: LinePlan = {
    geometry: g, axis, overX, midX,
    context: { x: g.left, y: g.top, width: midX - g.left, height: g.bottom - g.top },
    prediction: { x: midX, y: g.top, width: finishX - midX, height: g.bottom - g.top },
    contextLine: range(0, HALF), actualLast10: range(HALF, OVERS),
    wickets: e.wicket_overs.filter((o) => o !== HALF && o !== OVERS && o >= 1 && o < OVERS)
      .map((o) => ({ over: o, pt: at(o), band: o < HALF ? "context" as const : "prediction" as const })),
    dot, dotLabel: `${e.runs_at_10}/${e.wickets_at_10}`,
    finishX, actual: at(OVERS), tv: { x: finishX, y: sy(e.tv_projection) }, nothing: { x: finishX, y: sy(averageTotal) },
    lens,
    headings: { context: ["CONTEXT", "first 10 overs"], prediction: ["THE PREDICTION", "where will the last 10 ", "overs take it?"] },
  };
  return {
    mode, layout: mode === "wide" ? "split" : "stacked", line, zoom, joins,
    shares: mode === "wide" ? { line: g.panel / g.width, zoom: zoom.card.width / g.width } : { line: 1, zoom: 1 },
  };
}

// ---------------- drawing ----------------

const SVG_NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

// a background-coloured outline so a note stays readable where a line passes behind it
const HALO = { stroke: "var(--surface)", "stroke-width": 4, "stroke-linejoin": "round", "paint-order": "stroke" };
const round = (n: number) => Math.round(n * 10) / 10;
const points = (pts: Pt[]) => pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
const diamond = (p: Pt, size: number, attrs: Attrs) =>
  el("rect", { x: round(p.x) - size / 2, y: round(p.y) - size / 2, width: size, height: size, transform: `rotate(45 ${round(p.x)} ${round(p.y)})`, ...attrs });

/** The line graph, drawn into `svg` (wide: the left panel of the one drawing). */
function drawLine(svg: SVGSVGElement, p: LinePlan): void {
  const g = p.geometry;
  const sy = (runs: number) => g.bottom - (runs / p.axis.max) * (g.bottom - g.top);
  const group = el("g", { "data-testid": "worm-line" });
  svg.append(group);
  const add = (...nodes: Element[]) => group.append(...nodes);

  // the context band (overs 0 to 10) and the prediction area (10 to 20), each with a two-line heading above it
  add(el("rect", { x: round(p.context.x), y: p.context.y, width: round(p.context.width), height: p.context.height, fill: "var(--context-band)", "data-testid": "worm-context", "data-over-from": 0, "data-over-to": 10 }),
    el("rect", { x: round(p.prediction.x), y: p.prediction.y, width: round(p.prediction.width), height: p.prediction.height, fill: "var(--surface)", "data-testid": "worm-prediction", "data-over-from": 10, "data-over-to": 20 }));
  const head = (x: number, big: string, small: (string)[], fill: string, testid: string) => {
    const t = el("text", { x: round(x), y: g.top - 14 - small.length * (g.head + 3), "font-size": g.head, "font-weight": 700, "letter-spacing": 0.8, fill, "data-testid": testid });
    t.append(el("tspan", {}, big));
    small.forEach((line, i) => t.append(el("tspan", { x: round(x), dy: i === 0 ? g.head + 5 : g.head + 3, "font-weight": 400, "letter-spacing": 0, fill: "var(--muted)" }, line)));
    return t;
  };
  add(head(p.context.x + 6, p.headings.context[0], [p.headings.context[1]], "var(--muted)", "worm-context-heading"),
    head(p.prediction.x + 8, p.headings.prediction[0], [p.headings.prediction[1], p.headings.prediction[2]], "var(--text)", "worm-prediction-heading"));

  // gridlines and axes
  for (const t of p.axis.ticks) {
    if (t > 0) add(el("line", { x1: g.left, y1: round(sy(t)), x2: g.right, y2: round(sy(t)), stroke: "var(--border)", "stroke-width": 1 }));
    add(el("text", { x: g.left - 8, y: round(sy(t)) + 4, "text-anchor": "end", "font-size": g.tick, fill: "var(--muted)", "data-testid": "worm-axis-label" }, String(t)));
  }
  add(el("line", { x1: g.left, y1: g.bottom, x2: g.right, y2: g.bottom, stroke: "var(--muted)", "stroke-width": 1.5 }));
  for (const o of [0, 5, 10, 15, 20]) {
    const x = p.overX(o);
    add(el("text", { x: round(x), y: g.bottom + 18, "text-anchor": o === 20 ? "end" : "middle", "font-size": g.tick, "font-weight": o === 20 ? 700 : 400, fill: o === 20 ? "var(--text)" : "var(--muted)",
      "data-testid": "worm-axis-label", "data-over": o }, o === 20 ? "20 overs" : String(o)));
  }

  // the 10-over line
  add(el("line", { x1: round(p.midX), y1: g.top - 4, x2: round(p.midX), y2: g.bottom, stroke: "var(--text)", "stroke-width": 1.5, "stroke-dasharray": "3 4", "data-testid": "worm-ten" }));

  // the first 10 overs in grey, then what actually happened (solid, in the text colour) with its label in the white area
  const midPt = p.actualLast10[Math.floor(p.actualLast10.length / 2)];
  const labelX = Math.min(p.finishX - 70, Math.max(p.midX + 70, midPt.x));
  add(el("polyline", { points: points(p.contextLine), fill: "none", stroke: "var(--context-line)", "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round", "data-series": "actual-first-10", "data-testid": "worm-series-context" }),
    el("polyline", { points: points(p.actualLast10), fill: "none", stroke: "var(--text)", "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round", "data-series": "actual-last-10", "data-testid": "worm-series-actual" }),
    el("text", { x: round(labelX), y: round(midPt.y) - 16, "text-anchor": "middle", "font-size": g.note, fill: "var(--muted)", ...HALO, "data-testid": "worm-actual-label" }, "what actually happened"));

  // the know-nothing guess (dotted) and the TV projection (dashed), from the 10-over dot to over 20
  add(el("line", { x1: round(p.dot.x), y1: round(p.dot.y), x2: round(p.nothing.x), y2: round(p.nothing.y), stroke: "var(--muted)", "stroke-width": 2.5, "stroke-dasharray": "2 5", "stroke-linecap": "round", "data-series": "nothing", "data-testid": "worm-series-nothing" }),
    el("line", { x1: round(p.dot.x), y1: round(p.dot.y), x2: round(p.tv.x), y2: round(p.tv.y), stroke: "var(--tv)", "stroke-width": 2.5, "stroke-dasharray": "9 6", "data-series": "tv", "data-testid": "worm-series-tv" }));

  // wickets: an open circle at the end of each over in which one fell; grey in the context band, in the text colour after
  for (const w of p.wickets) {
    const grey = w.band === "context";
    add(el("circle", { cx: round(w.pt.x), cy: round(w.pt.y), r: 4.5, fill: "var(--bg)", stroke: grey ? "var(--context-line)" : "var(--text)", "stroke-width": 2, "data-testid": "worm-wicket", "data-over": w.over, "data-band": w.band }));
  }

  // the finish line at over 20, with the three markers on it, and the lens that marks what the zoom shows
  add(el("line", { x1: round(p.finishX), y1: g.top, x2: round(p.finishX), y2: g.bottom, stroke: "var(--text)", "stroke-width": 2, "data-testid": "worm-finish" }),
    el("rect", { x: round(p.lens.x) - 6, y: round(p.lens.top), width: 12, height: Math.max(4, round(p.lens.bottom - p.lens.top)), rx: 4, fill: "none", stroke: "var(--text)", "stroke-width": 1.5, "data-testid": "worm-lens" }),
    el("circle", { cx: round(p.finishX), cy: round(p.tv.y), r: 5.5, fill: "var(--tv)", "data-testid": "worm-finish-tv" }),
    el("circle", { cx: round(p.finishX), cy: round(p.nothing.y), r: 5, fill: "var(--surface)", stroke: "var(--muted)", "stroke-width": 2, "data-testid": "worm-finish-nothing" }),
    diamond(p.actual, 12, { fill: "var(--text)", "data-testid": "worm-finish-actual" }));
  svg.querySelector('[data-testid="worm-finish-actual"]')?.setAttribute("data-final", "true");

  // the score at 10 overs
  add(el("circle", { cx: round(p.dot.x), cy: round(p.dot.y), r: 6, fill: "var(--text)" }),
    el("text", { x: round(p.dot.x) - 12, y: round(p.dot.y) - 10, "text-anchor": "end", "font-size": g.dot, "font-weight": 700, fill: "var(--text)", "data-testid": "worm-dot-label" }, p.dotLabel));
}

/** The zoom panel, drawn into `svg`. */
function drawZoom(svg: SVGSVGElement, z: ZoomPlan): void {
  const g = z.geometry, c = z.card;
  const group = el("g", { "data-testid": "worm-zoom" });
  svg.append(group);
  const add = (...nodes: Element[]) => group.append(...nodes);
  add(el("text", { x: round(c.x + 4), y: round(c.y - 22), "font-size": g.title, "font-weight": 700, "letter-spacing": 0.8, fill: "var(--text)", "data-testid": "worm-zoom-title" }, z.title[0]),
    el("text", { x: round(c.x + 4), y: round(c.y - 8), "font-size": g.small + 1, fill: "var(--muted)", "data-testid": "worm-zoom-title-2" }, z.title[1]),
    el("rect", { x: round(c.x), y: round(c.y), width: round(c.width), height: round(c.height), rx: 12, fill: "var(--surface)", stroke: "var(--border)", "stroke-width": 1.5 }));

  // the ruler of totals at 20 overs, ticks every 10 runs, labelled on its left
  add(el("line", { x1: round(z.ruler.x), y1: round(z.ruler.top), x2: round(z.ruler.x), y2: round(z.ruler.bottom), stroke: "var(--muted)", "stroke-width": 1.5, "data-testid": "worm-zoom-ruler" }));
  for (const t of z.ruler.ticks) {
    add(el("line", { x1: round(z.ruler.x) - 4, y1: round(t.y), x2: round(z.ruler.x), y2: round(t.y), stroke: "var(--muted)", "stroke-width": 1.5 }),
      el("text", { x: round(z.ruler.x) - 8, y: round(t.y) + 4, "text-anchor": "end", "font-size": g.small, fill: "var(--muted)", "data-testid": "worm-zoom-tick", "data-value": t.value }, String(t.value)));
  }

  // the TV's usual miss: a pale bar from TV - miss to TV + miss, right of the ruler
  const u = z.usualMiss;
  add(el("rect", { x: round(u.x), y: round(u.top), width: u.width, height: round(u.bottom - u.top), fill: "var(--tv)", "fill-opacity": 0.22, stroke: "var(--tv)", "stroke-opacity": 0.5, "stroke-width": 1,
    "data-testid": "worm-zoom-miss", "data-from": u.from, "data-to": u.to }));

  // the miss: a bracket from the TV's value to the actual total (none when spot on); its words are placed with the labels
  const b = z.bracket;
  if (b.direction !== "spot on") {
    add(el("path", { d: `M${round(b.x - 7)},${round(b.top)} H${round(b.x)} V${round(b.bottom)} H${round(b.x - 7)}`, fill: "none", stroke: "var(--tv)", "stroke-width": 2.5, "stroke-linejoin": "round",
      "data-testid": "worm-zoom-bracket", "data-direction": b.direction }));
  } else {
    add(el("line", { x1: round(b.x - 7), y1: round(z.markers.tv.y), x2: round(b.x), y2: round(z.markers.tv.y), stroke: "var(--tv)", "stroke-width": 2.5, "data-testid": "worm-zoom-bracket", "data-direction": "spot on" }));
  }

  // the markers on the ruler: a diamond (actual), the TV's filled dot, the know-nothing guess's open dot
  add(el("circle", { cx: round(z.markers.nothing.x), cy: round(z.markers.nothing.y), r: 6, fill: "var(--surface)", stroke: "var(--muted)", "stroke-width": 2.5, "data-testid": "worm-zoom-marker", "data-series": "nothing" }),
    el("circle", { cx: round(z.markers.tv.x), cy: round(z.markers.tv.y), r: 6.5, fill: "var(--tv)", "data-testid": "worm-zoom-marker", "data-series": "tv" }),
    diamond(z.markers.actual, 14, { fill: "var(--text)", "data-testid": "worm-zoom-marker", "data-series": "actual" }));

  // the labels, at each marker's height, pushed apart so none overlap
  const labelX = z.bracket.x + 12;
  const tone: Record<ZoomLabel["id"], { fill: string; weight: number; size: number }> = {
    actual: { fill: "var(--text)", weight: 700, size: g.label }, miss: { fill: "var(--tv)", weight: 700, size: g.label },
    tv: { fill: "var(--tv)", weight: 700, size: g.label }, nothing: { fill: "var(--muted)", weight: 400, size: g.label - 1 },
  };
  for (const l of z.labels) {
    add(el("text", { x: round(labelX), y: round(l.y), "font-size": tone[l.id].size, "font-weight": tone[l.id].weight, fill: tone[l.id].fill,
      "data-testid": l.id === "miss" ? "worm-zoom-bracket-words" : "worm-zoom-label", "data-series": l.id, ...(l.id === "miss" ? { "data-direction": z.bracket.direction } : {}) }, l.text));
  }

  // the agent's box (its prediction is not known) and the key for the usual-miss bar
  const a = z.agent;
  add(el("rect", { x: round(a.x), y: round(a.y), width: round(a.width), height: a.height, rx: 8, fill: "var(--accent)", "data-testid": "worm-zoom-agent" }),
    el("text", { x: round(a.x + a.width / 2), y: round(a.y + a.height / 2) - 2, "text-anchor": "middle", "font-size": g.label, "font-weight": 700, fill: "var(--on-accent)", "data-testid": "worm-zoom-agent-text" }, "The agent: ?"),
    el("text", { x: round(a.x + a.width / 2), y: round(a.y + a.height / 2) + 14, "text-anchor": "middle", "font-size": g.small + 1, fill: "var(--on-accent)" }, "where will it land?"));
  const k = z.key;
  add(el("rect", { x: round(k.x), y: round(k.y + 4), width: 14, height: 14, fill: "var(--tv)", "fill-opacity": 0.22, stroke: "var(--tv)", "stroke-opacity": 0.5, "stroke-width": 1 }),
    el("text", { x: round(k.x + 22), y: round(k.y + 16), "font-size": g.small, fill: "var(--text)", "data-testid": "worm-zoom-key" }, z.usualMiss.text));
}

/** The chart's SVG(s) for a plan: one when wide, the line graph then the zoom when narrow. The accessible label is the server's text equivalent. */
export function drawWorm(plan: Plan, chartText: string): SVGSVGElement[] {
  const lg = plan.line.geometry, zg = plan.zoom.geometry;
  if (plan.layout === "split") {
    const svg = el("svg", { viewBox: `0 0 ${lg.width} ${lg.height}`, role: "img", "aria-label": chartText, class: "worm", "data-testid": "worm-chart-svg", "data-mode": plan.mode });
    drawLine(svg, plan.line);
    for (const j of plan.joins) {
      svg.append(el("line", { x1: round(j.x1), y1: round(j.y1), x2: round(j.x2), y2: round(j.y2), stroke: "var(--muted)", "stroke-opacity": 0.55, "stroke-width": 1, "stroke-dasharray": "2 3", "data-testid": "worm-join" }));
    }
    drawZoom(svg, plan.zoom);
    return [svg];
  }
  const first = el("svg", { viewBox: `0 0 ${lg.width} ${lg.height}`, role: "img", "aria-label": chartText, class: "worm", "data-testid": "worm-chart-svg", "data-mode": plan.mode });
  drawLine(first, plan.line);
  const second = el("svg", { viewBox: `0 0 ${zg.card.x * 2 + zg.card.width} ${zg.card.y + zg.card.height + 6}`, class: "worm worm-zoom-svg", "data-testid": "worm-zoom-svg", "data-mode": plan.mode });
  drawZoom(second, plan.zoom);
  return [first, second];
}

/** Draws the chart into `host`, and redraws it (side by side or stacked) when the card's width crosses the breakpoint. */
export function mountWorm(card: HTMLElement, host: HTMLElement, input: WormInput): void {
  const current = (): Mode => layoutMode(card.clientWidth || NARROW_BELOW);
  let shown: Mode | null = null;
  const draw = () => {
    const mode = current();
    if (mode === shown) return;
    shown = mode;
    host.replaceChildren(...drawWorm(wormPlan(input, mode), input.chartText));
  };
  draw();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(draw).observe(card);
}
