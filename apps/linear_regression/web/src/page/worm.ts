// The hero's "worm" chart (app-specific): one real innings drawn as runs by over, as a broadcast shows it, with the TV
// projection, the know-nothing guess and what actually happened. Hand-built SVG, no library; nothing animates. Every value
// comes from the server (the example innings and the reference figures); wormPlan only turns them into places on the
// chart, and drawWorm draws the plan. Colours are the page's CSS variables, and the series are also told apart by line
// style and by label, never by colour alone.
import { fmt, h } from "./dom";
import type { Example } from "./reference-types";
import { labelMode, NARROW_BELOW, spreadLabels, yAxis, type YAxis } from "./worm-layout";

export type Mode = "side" | "key";
export type SeriesId = "actual" | "tv" | "nothing" | "agent";
export interface Pt { x: number; y: number }
export interface WormInput { example: Example; averageMiss: number; averageTotal: number; chartText: string }
export interface EndLabel { id: SeriesId; text: string; y: number }
export interface Geometry {
  width: number; height: number; left: number; right: number; top: number; bottom: number;
  tick: number; note: number; dot: number; end: number; labelX: number; gap: number;
}
export interface Plan {
  mode: Mode; geometry: Geometry; axis: YAxis;
  thick: Pt[]; thin: Pt[]; wickets: { over: number; pt: Pt; future: boolean }[];
  dot: Pt; dotLabel: string; final: Pt;
  tv: Pt; nothing: Pt;
  bar: { x: number; top: number; bottom: number; centre: number }; barLabel: string;
  labels: EndLabel[];
}

const OVERS = 20, HALF = 10;
const SIDE: Geometry = { width: 760, height: 360, left: 50, right: 600, top: 40, bottom: 320, tick: 12, note: 12, dot: 15, end: 14, labelX: 614, gap: 24 };
const KEY: Geometry = { width: 340, height: 290, left: 34, right: 322, top: 30, bottom: 244, tick: 11, note: 11, dot: 13, end: 12, labelX: 0, gap: 18 };

export const geometryFor = (mode: Mode): Geometry => (mode === "side" ? SIDE : KEY);

/** Where everything goes. Pure: the same input and mode always give the same plan. */
export function wormPlan(input: WormInput, mode: Mode): Plan {
  const { example: e, averageMiss, averageTotal } = input;
  const g = geometryFor(mode);
  const axis = yAxis([...e.runs, e.tv_projection + averageMiss, e.tv_projection, averageTotal]);
  const sx = (over: number) => g.left + (over / OVERS) * (g.right - g.left);
  const sy = (runs: number) => g.bottom - (runs / axis.max) * (g.bottom - g.top);
  const at = (over: number): Pt => ({ x: sx(over), y: sy(over === 0 ? 0 : e.runs[over - 1]) });
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => at(from + i));

  const dot = at(HALF), final = at(OVERS);
  const tv: Pt = { x: sx(OVERS), y: sy(e.tv_projection) };
  const nothing: Pt = { x: sx(OVERS), y: sy(averageTotal) };
  const barX = g.right - (mode === "side" ? 14 : 10);

  // end labels: sorted by value and pushed apart so they never overlap; the agent's "?" sits below the rest
  const wished = (y: number) => y + g.end * 0.3;
  const known = [
    { id: "actual" as const, text: `Actual ${e.final_total}`, y: wished(final.y) },
    { id: "tv" as const, text: `TV projection ${e.tv_projection}`, y: wished(tv.y) },
    { id: "nothing" as const, text: `Know-nothing ${Math.round(averageTotal)}`, y: wished(nothing.y) },
  ];
  const agentY = Math.max(...known.map((k) => k.y)) + g.gap * 1.3;
  const all = [...known, { id: "agent" as const, text: "The agent: ?", y: agentY }];
  const placed = spreadLabels(all.map((k) => ({ id: k.id, y: k.y })), g.gap, g.top - 20, g.bottom);
  const labels = all.map((k) => ({ ...k, y: placed[k.id] })).sort((a, b) => a.y - b.y);

  return {
    mode, geometry: g, axis,
    thick: range(0, HALF), thin: range(HALF, OVERS),
    wickets: e.wicket_overs.filter((o) => o !== HALF && o !== OVERS && o >= 1 && o < OVERS).map((o) => ({ over: o, pt: at(o), future: o > HALF })),
    dot, dotLabel: `${e.runs_at_10}/${e.wickets_at_10}`, final, tv, nothing,
    bar: { x: barX, top: sy(e.tv_projection + averageMiss), bottom: sy(e.tv_projection - averageMiss), centre: tv.y },
    barLabel: `TV's average miss: ±${fmt(averageMiss)} runs`,
    labels,
  };
}

// ---------------- drawing ----------------

const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

// a background-coloured outline so a note stays readable where a line passes behind it
const HALO = { stroke: "var(--surface)", "stroke-width": 4, "stroke-linejoin": "round", "paint-order": "stroke" };
const round = (n: number) => Math.round(n * 10) / 10;
const points = (pts: Pt[]) => pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
const TONE: Record<SeriesId, { fill: string; weight: string }> = {
  actual: { fill: "var(--text)", weight: "700" },
  tv: { fill: "var(--tv)", weight: "700" },
  nothing: { fill: "var(--muted)", weight: "400" },
  agent: { fill: "var(--accent)", weight: "700" },
};

/** The chart's SVG for a plan. The accessible label is the server's text equivalent. */
export function drawWorm(plan: Plan, chartText: string): SVGSVGElement {
  const g = plan.geometry;
  const svg = el("svg", { viewBox: `0 0 ${g.width} ${g.height}`, role: "img", "aria-label": chartText, class: "worm", "data-testid": "worm-chart-svg", "data-mode": plan.mode });
  const midX = g.left + ((g.right - g.left) * HALF) / OVERS;

  // the future (overs 11 to 20), then gridlines and axes
  svg.append(el("rect", { x: round(midX), y: g.top, width: round(g.right - midX), height: g.bottom - g.top, fill: "var(--surface)" }));
  const sy = (runs: number) => g.bottom - (runs / plan.axis.max) * (g.bottom - g.top);
  for (const t of plan.axis.ticks) {
    if (t > 0) svg.append(el("line", { x1: g.left, y1: round(sy(t)), x2: g.right, y2: round(sy(t)), stroke: "var(--border)", "stroke-width": 1 }));
    svg.append(el("text", { x: g.left - 8, y: round(sy(t)) + 4, "text-anchor": "end", "font-size": g.tick, fill: "var(--muted)", "data-testid": "worm-axis-label" }, String(t)));
  }
  svg.append(el("line", { x1: g.left, y1: g.bottom, x2: g.right, y2: g.bottom, stroke: "var(--muted)", "stroke-width": 1.5 }));
  for (const o of [0, 5, 10, 15, 20]) {
    const x = g.left + ((g.right - g.left) * o) / OVERS;
    svg.append(el("text", { x: round(x), y: g.bottom + 20, "text-anchor": o === 20 ? "end" : "middle", "font-size": g.tick, fill: "var(--muted)", "data-testid": "worm-axis-label" }, o === 20 ? "20 overs" : String(o)));
  }

  // the 10-over line
  svg.append(el("line", { x1: round(midX), y1: g.top - 6, x2: round(midX), y2: g.bottom, stroke: "var(--text)", "stroke-width": 1.5, "stroke-dasharray": "3 4" }),
    el("text", { x: round(midX) + 8, y: g.top - 10, "font-size": g.tick, "font-weight": 600, fill: "var(--text)", "data-testid": "worm-axis-label" }, "10 overs"));

  // what actually happened (overs 11 to 20), then the first 10 overs
  const mid = plan.thin[Math.floor(plan.thin.length / 2)];
  svg.append(el("polyline", { points: points(plan.thin), fill: "none", stroke: "var(--text)", "stroke-width": 2.5, "stroke-opacity": 0.45, "stroke-linejoin": "round", "stroke-linecap": "round", "data-series": "actual-last-10" }),
    el("text", { x: round(mid.x) + 6, y: round(mid.y) - 16, "text-anchor": "end", "font-size": g.note, fill: "var(--muted)", ...HALO }, "what actually happened"),
    el("polyline", { points: points(plan.thick), fill: "none", stroke: "var(--text)", "stroke-width": 4, "stroke-linejoin": "round", "stroke-linecap": "round", "data-series": "actual-first-10" }));

  // the know-nothing guess (dotted) and the TV projection (dashed), from the 10-over dot to over 20
  svg.append(el("line", { x1: round(plan.dot.x), y1: round(plan.dot.y), x2: round(plan.nothing.x), y2: round(plan.nothing.y), stroke: "var(--muted)", "stroke-width": 2.5, "stroke-dasharray": "2 5", "stroke-linecap": "round", "data-series": "nothing" }),
    el("line", { x1: round(plan.dot.x), y1: round(plan.dot.y), x2: round(plan.tv.x), y2: round(plan.tv.y), stroke: "var(--tv)", "stroke-width": 2.5, "stroke-dasharray": "9 6", "data-series": "tv" }));

  // the TV's typical miss, an error bar at over 20 centred on its projection
  const b = plan.bar;
  const barLine = (x1: number, y1: number, x2: number, y2: number) =>
    el("line", { x1, y1: round(y1), x2, y2: round(y2), stroke: "var(--tv)", "stroke-width": 2, "data-series": "tv-miss" });
  svg.append(barLine(b.x, b.top, b.x, b.bottom), barLine(b.x - 6, b.top, b.x + 6, b.top), barLine(b.x - 6, b.bottom, b.x + 6, b.bottom),
    el("text", { x: b.x - 12, y: round(b.bottom) + g.note + 6, "text-anchor": "end", "font-size": g.note, fill: "var(--tv)", ...HALO, "data-testid": "worm-miss-label" }, plan.barLabel));

  // wickets: an open circle at the end of each over in which one fell (not on the dot or the diamond)
  for (const w of plan.wickets) {
    svg.append(el("circle", { cx: round(w.pt.x), cy: round(w.pt.y), r: w.future ? 4 : 4.5, fill: "var(--bg)", stroke: "var(--text)", "stroke-width": 2, "stroke-opacity": w.future ? 0.6 : 1, "data-testid": "worm-wicket", "data-over": w.over }));
  }

  // the score at 10 overs, and the final total
  svg.append(el("circle", { cx: round(plan.dot.x), cy: round(plan.dot.y), r: 6, fill: "var(--text)" }),
    el("text", { x: round(plan.dot.x) - 12, y: round(plan.dot.y) - 10, "text-anchor": "end", "font-size": g.dot, "font-weight": 700, fill: "var(--text)", "data-testid": "worm-dot-label" }, plan.dotLabel),
    el("rect", { x: round(plan.final.x) - 6, y: round(plan.final.y) - 6, width: 12, height: 12, transform: `rotate(45 ${round(plan.final.x)} ${round(plan.final.y)})`, fill: "var(--text)", "data-testid": "worm-final" }));

  // end labels beside the chart (a narrow chart shows them in a key instead)
  if (plan.mode === "side") {
    for (const l of plan.labels) {
      svg.append(el("text", { x: g.labelX, y: round(l.y), "font-size": g.end, "font-weight": TONE[l.id].weight, fill: TONE[l.id].fill, "data-testid": "worm-end-label", "data-series": l.id }, l.text));
    }
  }
  return svg;
}

/** The key shown under a narrow chart in place of the end labels. */
export function drawKey(plan: Plan): HTMLElement {
  const order: SeriesId[] = ["actual", "tv", "nothing", "agent"];
  const byId = new Map(plan.labels.map((l) => [l.id, l]));
  return h("ul", { class: "worm-key", "data-testid": "worm-key" },
    ...order.map((id) => h("li", { class: `worm-key-item worm-key-${id}`, "data-testid": "worm-end-label", "data-series": id }, byId.get(id)!.text)));
}

/** Draws the chart into `host`, and redraws it (labels beside or in a key) when the card's width crosses the breakpoint. */
export function mountWorm(card: HTMLElement, host: HTMLElement, input: WormInput): void {
  const current = (): Mode => labelMode(card.clientWidth || NARROW_BELOW);
  let shown: Mode | null = null;
  const draw = () => {
    const mode = current();
    if (mode === shown) return;
    shown = mode;
    const plan = wormPlan(input, mode);
    host.replaceChildren(drawWorm(plan, input.chartText), ...(mode === "key" ? [drawKey(plan)] : []));
  };
  draw();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(draw).observe(card);
}
