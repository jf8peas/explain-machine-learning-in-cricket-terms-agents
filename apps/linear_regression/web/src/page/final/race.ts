// The bars of The final test's section 1 (app-specific): all the predictions on the test year as HTML bars from zero on one
// shared scale, sorted by average miss (shortest first), with no place labels; the chosen model carries an outlined "our pick"
// tag. Every number is the run's. Everything goes in as text, nothing animates, and the colour of a method is always paired
// with its name, the TV bar's hatch or the know-nothing bar's grey.
import { renderSegs, type Seg } from "../exam";
import { fmt, h } from "../dom";
import { PICK_NOTE, TOKEN, type Row } from "./view";

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

const COUNT_WORDS = ["no", "one", "two", "three", "four"];

/** The section's lead as plain text: "All four predictions on 2026. " and the bold "Shorter bar = more accurate." (three without the AI's model). */
export function raceLead(testYear: number | undefined, count: number): [string, string] {
  const words = COUNT_WORDS[count] ?? String(count);
  return [testYear === undefined ? `All ${words} predictions. ` : `All ${words} predictions on ${testYear}. `, "Shorter bar = more accurate."];
}

// ---------------- rendering ----------------

function axis(max: number): HTMLElement {
  const area = h("span", { class: "race-area race-axis-area" });
  for (const t of ticks(max)) {
    const tick = h("span", { class: "race-tick", "data-testid": "race-tick" }, String(t));
    tick.style.left = `${barPercent(t, max)}%`;
    area.append(tick);
  }
  const caption = h("span", { class: "race-axis-caption" }, "runs off, on average");
  return h("div", { class: "race-row race-axis", "data-testid": "race-axis" }, h("span", { class: "race-name" }), area, caption);
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
  return h("div", { class: "race-row", "data-testid": "race-row", "data-method": r.id }, name, area);
}

/** The lead, the bars with their axis and, under them, the comparison sentence (absent without both models). */
export function renderRace(rows: Row[], testYear: number | undefined, compare: Seg[]): HTMLElement[] {
  const max = scaleMax(rows.map((r) => r.miss));
  const [before, strong] = raceLead(testYear, rows.length);
  const lead = h("p", { class: "final-lead" }, before, h("strong", {}, strong));
  const chart = h("div", { class: "race", "data-testid": "race" }, ...rows.map((r) => raceRow(r, max)), axis(max));
  return [lead, chart, ...(compare.length ? [h("p", { class: "compare-line", "data-testid": "compare-line" }, ...renderSegs(compare))] : [])];
}
