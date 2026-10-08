// The predicted-versus-actual chart (app-specific), hand-built SVG, no library. x is the actual final total and y the
// predicted one, so a method that guesses too low sits below the diagonal. The pure helpers (axis range, ticks, the
// selection rules) are exported for tests; renderChart draws the whole thing. Colours come from the page's CSS
// variables, but the marker shape is what tells methods apart. Nothing animates.
import { h } from "./dom";
import type { MethodDef } from "./reference";

export interface ChartPoints { actual: number[]; predicted: Record<string, number[]> }
export interface Range { min: number; max: number; step: number }
export type Marker = "square" | "circle" | "triangle" | "diamond";

const SVG_NS = "http://www.w3.org/2000/svg";
const MARKERS: Marker[] = ["square", "circle", "triangle", "diamond"];
const TARGET_INTERVALS = 6;

// ---------------- pure helpers ----------------

/** The step between ticks: 1, 2, 2.5 or 5 times a power of ten, the smallest that gives about six intervals. */
function niceStep(span: number): number {
  const raw = span / TARGET_INTERVALS;
  const power = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw - 1e-12) ?? 10) * power;
}

/** One range for both axes, with round ends, covering the actual totals and every method's predictions. Worked out from
 *  all methods, never just the shown ones, so the axes do not move when a method is switched on or off. */
export function axisRange(points: ChartPoints): Range {
  const values = [...points.actual, ...Object.values(points.predicted).flat()].filter((v) => Number.isFinite(v));
  let lo = Math.min(...values), hi = Math.max(...values);
  if (!(hi > lo)) { lo -= 5; hi += 5; }
  const step = niceStep(hi - lo);
  const round = (x: number) => Number(x.toFixed(10));
  return { min: round(Math.floor(lo / step) * step), max: round(Math.ceil(hi / step) * step), step };
}

export function niceTicks(r: Range): number[] {
  const count = Math.round((r.max - r.min) / r.step);
  return Array.from({ length: count + 1 }, (_, i) => Number((r.min + i * r.step).toFixed(10)));
}

export function markerFor(def: MethodDef): Marker {
  return (MARKERS as string[]).includes(def.marker) ? (def.marker as Marker) : "circle";
}

/** What the chart opens with: the TV projection and the winning model, in display order. */
export function defaultSelection(offered: string[], winner: string): string[] {
  return offered.filter((id) => id === "broadcaster" || id === winner);
}

export function selectionAfterToggle(selection: string[], id: string, offered: string[]): string[] {
  if (!offered.includes(id)) return selection.filter((s) => offered.includes(s));
  const next = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
  return offered.filter((m) => next.includes(m));
}

/** The selected methods that have points to draw. */
export function shownMethods(selection: string[], points: ChartPoints): string[] {
  return selection.filter((id) => id in points.predicted);
}

// ---------------- drawing ----------------

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** One open shape centred on (cx, cy). */
function shape(marker: Marker, cx: number, cy: number, r: number): SVGElement {
  const k = r * 1.25;
  switch (marker) {
    case "square": return svg("rect", { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r });
    case "diamond": return svg("path", { d: `M${cx},${cy - k} L${cx + k},${cy} L${cx},${cy + k} L${cx - k},${cy} Z` });
    case "triangle": return svg("path", { d: `M${cx},${cy - k} L${cx + k},${cy + k * 0.8} L${cx - k},${cy + k * 0.8} Z` });
    default: return svg("circle", { cx, cy, r });
  }
}

const colourOf = (id: string) => `var(--m-${id.replace(/_/g, "-")}, var(--text))`;

// The selection is remembered while the same results are on show, so a replay step that redraws the results keeps it.
let remembered: { key: string; ids: string[] } | null = null;

export interface ChartOptions {
  points: ChartPoints;
  defs: MethodDef[];
  methods: string[];          // the methods on offer, in display order
  winner: string;
  identical: string[][];
  testYear?: number;
}

const VIEW_W = 480, VIEW_H = 470, AREA = { x: 64, y: 14, size: 392 };

export function renderChart(o: ChartOptions): HTMLElement {
  const key = `${o.methods.join(",")}|${o.winner}`;
  if (!remembered || remembered.key !== key) remembered = { key, ids: defaultSelection(o.methods, o.winner) };
  const state = remembered;
  const range = axisRange(o.points);
  const span = range.max - range.min;
  const sx = (v: number) => AREA.x + ((v - range.min) / span) * AREA.size;
  const sy = (v: number) => AREA.y + AREA.size - ((v - range.min) / span) * AREA.size;
  const nameOf = (id: string) => o.defs.find((d) => d.id === id)?.name ?? id;
  const defOf = (id: string) => o.defs.find((d) => d.id === id) ?? { id, name: id, note: "", marker: "circle" };

  const root = h("section", { class: "chart", "data-testid": "accuracy-chart", "aria-label": "Predicted against actual final totals" });
  const plot = svg("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, class: "chart-plot", "data-testid": "chart-plot", role: "img",
    "aria-label": "Chart of predicted against actual final totals for each test innings. Every figure is in the table above." });

  // the frame, gridlines and ticks, which never change
  plot.append(svg("rect", { class: "chart-area", "data-testid": "chart-plot-area", x: AREA.x, y: AREA.y, width: AREA.size, height: AREA.size }));
  for (const t of niceTicks(range)) {
    const x = sx(t), y = sy(t);
    plot.append(svg("line", { class: "chart-grid", x1: x, y1: AREA.y, x2: x, y2: AREA.y + AREA.size }),
      svg("line", { class: "chart-grid", x1: AREA.x, y1: y, x2: AREA.x + AREA.size, y2: y }));
    const xl = svg("text", { class: "chart-tick", x, y: AREA.y + AREA.size + 16, "data-testid": "chart-tick", "data-axis": "x", "data-value": t });
    xl.textContent = String(t);
    const yl = svg("text", { class: "chart-tick y", x: AREA.x - 8, y: y + 4, "data-testid": "chart-tick", "data-axis": "y", "data-value": t });
    yl.textContent = String(t);
    plot.append(xl, yl);
  }
  const xTitle = svg("text", { class: "chart-title", x: AREA.x + AREA.size / 2, y: VIEW_H - 8 });
  xTitle.textContent = "Actual final total (runs)";
  const yTitle = svg("text", { class: "chart-title", transform: `translate(14,${AREA.y + AREA.size / 2}) rotate(-90)` });
  yTitle.textContent = "Predicted final total (runs)";
  plot.append(xTitle, yTitle,
    svg("line", { class: "chart-diagonal", "data-testid": "chart-diagonal", x1: sx(range.min), y1: sy(range.min), x2: sx(range.max), y2: sy(range.max) }));
  const layer = svg("g", { class: "chart-marks" });
  plot.append(layer);

  const prompt = h("p", { class: "muted", "data-testid": "chart-prompt", hidden: "" }, "Choose a method above to see its guesses.");
  const toggles = h("div", { class: "chart-toggles", role: "group", "aria-label": "Methods shown on the chart" });

  function draw() {
    layer.replaceChildren();
    const actual = o.points.actual;
    for (const id of shownMethods(state.ids, o.points)) {
      const g = svg("g", { class: "marks", "data-method": id, style: `color: ${colourOf(id)}` });
      const marker = markerFor(defOf(id));
      o.points.predicted[id].forEach((p, i) => {
        const mark = shape(marker, sx(actual[i]), sy(p), 3.4);
        mark.setAttribute("class", "mark");
        mark.setAttribute("data-testid", "chart-mark");
        mark.setAttribute("data-method", id);
        mark.setAttribute("data-marker", marker);
        g.append(mark);
      });
      layer.append(g);
    }
    prompt.hidden = shownMethods(state.ids, o.points).length > 0;
    toggles.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(state.ids.includes(b.dataset.method as string))));
  }

  for (const id of o.methods) {
    const icon = svg("svg", { class: "chart-key-icon", viewBox: "0 0 16 16", "aria-hidden": "true", width: 16, height: 16 });
    const glyph = shape(markerFor(defOf(id)), 8, 8, 5);
    glyph.setAttribute("class", "mark");
    glyph.setAttribute("data-marker", markerFor(defOf(id)));
    icon.append(glyph);
    const button = h("button", { type: "button", class: "chart-toggle", "data-testid": "chart-toggle", "data-method": id,
      "aria-pressed": String(state.ids.includes(id)), style: `color: ${colourOf(id)}` });
    button.append(icon, h("span", { class: "chart-toggle-name" }, nameOf(id)));
    button.addEventListener("click", () => { state.ids = selectionAfterToggle(state.ids, id, o.methods); draw(); });
    toggles.append(button);
  }

  const first = Object.values(o.points.predicted)[0] ?? o.points.actual;
  root.append(h("h4", { class: "chart-heading" }, "Predicted against actual, test year"), toggles, plot, prompt);
  if (o.identical.length) {
    root.append(h("p", { class: "muted", "data-testid": "chart-identical" },
      `${o.identical.map((p) => p.map(nameOf).join(" and ")).join("; ")} gave identical guesses, so their marks sit exactly on top of each other.`));
  }
  root.append(h("p", { class: "muted", "data-testid": "chart-caption" },
    `One mark for each of the ${first.length} innings in the test year${o.testYear ? ` (${o.testYear})` : ""}. The diagonal line is a perfect guess: a mark below the line is a guess that was too low, and a mark above it was too high.`));
  draw();
  return root;
}
