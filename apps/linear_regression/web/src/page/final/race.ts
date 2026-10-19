// Section 1 of the final test tab (app-specific): who won the prediction race. The methods as HTML bars from zero on one
// shared scale, sorted by average miss (best first), then one verdict line against the goal. Every number is the run's;
// the verdict wording is the server's (a code-only block). Everything goes in as text, nothing animates, and the colour
// of a method is always paired with its name, the TV bar's hatch or the know-nothing bar's grey.
import { fmt, h } from "../dom";
import { PICK_NOTE, TOKEN, type Row } from "./view";
import type { Block, Verdict } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------- pure helpers (exported for tests) ----------------

/** The scale's end: the longest average miss rounded up to the next 10 runs (10 when every bar is zero). */
export function scaleMax(misses: number[]): number {
  const longest = Math.max(0, ...misses);
  return longest <= 0 ? 10 : Math.ceil(longest / 10 - 1e-9) * 10;
}

/** The gridline labels: 0, then every 10 runs up to the end of the scale. */
export function ticks(max: number): number[] {
  const out: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += 10) out.push(t);
  return out;
}

/** A bar's length as a share of the scale. */
export function barPercent(miss: number, max: number): number {
  return Math.max(0, Math.min(100, (miss / max) * 100));
}

// ---------------- rendering ----------------

function verdictShape(shape: string): SVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20"); svg.setAttribute("width", "22"); svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "verdict-shape-svg");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", shape === "tick" ? "M4.5 10.5 L8.5 14.5 L15.5 5.5" : shape === "dash" ? "M4 10 L16 10" : "M5 5 L15 15 M15 5 L5 15");
  path.setAttribute("class", "verdict-mark");
  svg.append(path);
  return svg;
}

function verdictLine(block: Block): HTMLElement[] {
  const v = block.visual as { variant?: Verdict; shape?: string; race_leader_differs?: boolean };
  const reached = v.variant === "reached";
  const line = h("p", { class: `verdict-line ${reached ? "win" : "lose"}`, "data-testid": "verdict", "data-variant": v.variant ?? "" });
  const shape = h("span", { class: "verdict-shape", "data-testid": "verdict-shape", "data-shape": v.shape ?? "" });
  shape.append(verdictShape(v.shape ?? "cross"));
  line.append(shape, h("span", {}, h("strong", {}, `${block.title}. `), block.sentences[0] ?? ""));
  const out: HTMLElement[] = [line];
  if (v.race_leader_differs && block.sentences[1]) out.push(h("p", { class: "verdict-leader", "data-testid": "verdict-leader" }, block.sentences[1]));
  return out;
}

function axis(max: number): HTMLElement {
  const area = h("span", { class: "race-area race-axis-area" });
  for (const t of ticks(max)) {
    const tick = h("span", { class: "race-tick", "data-testid": "race-tick" }, String(t));
    tick.style.left = `${barPercent(t, max)}%`;
    area.append(tick);
  }
  const caption = h("span", { class: "race-axis-caption" }, "runs off, on average");
  return h("div", { class: "race-row race-axis", "data-testid": "race-axis" }, h("span", { class: "race-place" }), h("span", { class: "race-name" }), area, caption);
}

function raceRow(r: Row, max: number): HTMLElement {
  const name = h("span", { class: "race-name" },
    h("strong", { class: "race-method" }, r.name),
    ...(r.description ? [h("span", { class: "race-desc" }, r.description)] : []),
    ...(r.isChosen ? [h("span", { class: "race-pick", "data-testid": "race-pick" }, PICK_NOTE)] : []));
  (name.firstElementChild as HTMLElement).style.color = TOKEN[r.id] ?? "inherit";
  const bar = h("span", { class: `race-bar race-bar-${r.id}`, "data-testid": "race-bar", "data-method": r.id,
    ...(r.id === "broadcaster" ? { "data-hatched": "true" } : {}) });
  const pct = barPercent(r.miss, max);
  bar.style.width = `${pct}%`;
  const value = h("span", { class: "race-value", "data-testid": "race-value" }, fmt(r.miss));
  value.style.left = `${pct}%`;
  const area = h("span", { class: "race-area" }, bar, value);
  area.style.setProperty("--step", `${barPercent(10, max)}%`);
  return h("div", { class: `race-row${r.place === 1 ? " race-first" : ""}`, "data-testid": "race-row", "data-method": r.id, "data-place": String(r.place) },
    h("span", { class: "race-place", style: `color:${TOKEN[r.id] ?? "inherit"}` }, r.placeLabel), name, area);
}

/** Section 1's content: the lead, the bars with their axis and, once the explanation exists, the verdict line. */
export function renderRace(rows: Row[], verdict: Block | undefined): HTMLElement[] {
  const max = scaleMax(rows.map((r) => r.miss));
  const lead = h("p", { class: "final-lead" }, "The ", h("strong", {}, "average miss"),
    ": how many runs each prediction was off the real final total, on average. ", h("strong", {}, "Shorter bar = more accurate."));
  const chart = h("div", { class: "race", "data-testid": "race" }, ...rows.map((r) => raceRow(r, max)), axis(max));
  return [lead, chart, ...(verdict ? verdictLine(verdict) : [])];
}
