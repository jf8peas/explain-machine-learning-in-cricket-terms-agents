// Section 3 of What the agent found: the race chart on the check seasons and the choice panel (app-specific). The chart is a
// hand-built SVG, no library, nothing animates. Every value comes from the run (see view.ts); the marks are told apart by
// shape and by word as well as by colour. The choice panel describes the decision recorded on validation, before the final
// test; it never calls either exam's result "the winner".
import { h } from "../dom";
import { renderSegs } from "../exam";
import { endLabels, PLOT, xPlace, yPlace, yRange } from "./race-layout";
import { choiceHeading, choiceText, fromTenths, type FoundView, type RoundView } from "./view";

const SVG_NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

const runs = (tenths: number) => tenths / 10;
const LANE = PLOT.bottom + 30;     // where rejected, finished and failed rounds are marked, below the plot

function markKind(r: RoundView): string {
  return r.kind === "fitted" ? (r.improved ? "best" : "fitted") : r.kind;
}

/** What the chart says in words: every round's outcome and score, the rival's best and the TV's. */
export function raceText(view: FoundView): string {
  const parts: string[] = [];
  if (view.rounds.length) {
    parts.push("Average miss on the check seasons by AI round.");
    for (const r of view.rounds) {
      const what = r.kind === "pending" ? "not scored yet" : r.kind === "fitted"
        ? `${fromTenths(r.miss as number)} runs, ${r.improved ? (r.firstScore ? "the first score" : "a new best") : "no better"}`
        : r.kind === "rejected" ? "rejected by code" : r.kind === "finished" ? "the AI said it was finished" : "the AI failed";
      parts.push(`Round ${r.round}: ${what}.`);
    }
  } else {
    parts.push("The AI made no proposals in this run.");
  }
  if (view.aiBest !== null) parts.push(`The AI's best was ${fromTenths(view.aiBest)}.`);
  if (view.rival !== null) parts.push(`The rival's best was ${fromTenths(view.rival)}.`);
  if (view.tv !== null) parts.push(`The TV projection's was ${fromTenths(view.tv)}.`);
  return parts.join(" ");
}

export function renderRaceChart(view: FoundView): HTMLElement | null {
  if (!view.rounds.length && view.rival === null && view.tv === null) return null;
  const n = view.roundsUsed;
  const values = [
    ...view.rounds.filter((r) => r.miss !== null).map((r) => runs(r.miss as number)),
    ...view.bestSoFar.map((b) => runs(b.miss)),
    ...(view.rival === null ? [] : [runs(view.rival)]), ...(view.tv === null ? [] : [runs(view.tv)]),
  ];
  const range = yRange(values);
  const y = (v: number) => yPlace(range, v);
  const root = svg("svg", { viewBox: `0 0 ${PLOT.width} ${PLOT.height}`, class: "race-svg", role: "img", "aria-label": raceText(view),
    "data-testid": "race-chart" });

  const grid = svg("g", { class: "race-grid" });
  const ticks = svg("g", { class: "race-ticks", "text-anchor": "end" });
  for (const t of range.ticks) {
    grid.append(svg("line", { x1: PLOT.left, y1: y(t), x2: PLOT.right, y2: y(t) }));
    ticks.append(svg("text", { x: PLOT.left - 8, y: y(t) + 4 }, String(t)));
  }
  root.append(grid, ticks,
    svg("text", { x: 14, y: (PLOT.top + PLOT.bottom) / 2, class: "race-axis", transform: `rotate(-90 14 ${(PLOT.top + PLOT.bottom) / 2})`, "text-anchor": "middle" }, "average miss on check seasons"));
  if (n > 0) {
    const xs = svg("g", { class: "race-ticks", "text-anchor": "middle" });
    for (let i = 1; i <= n; i++) xs.append(svg("text", { x: xPlace(i, n), y: PLOT.height - 28 }, String(i)));
    root.append(xs, svg("text", { x: (PLOT.left + PLOT.right) / 2, y: PLOT.height - 8, class: "race-axis", "text-anchor": "middle" }, "AI agent's round"));
  }

  const wished: { id: string; y: number }[] = [];
  const texts: Record<string, string> = {};
  if (view.tv !== null) {
    root.append(svg("line", { x1: PLOT.left, y1: y(runs(view.tv)), x2: PLOT.right, y2: y(runs(view.tv)), class: "race-line race-tv", "data-testid": "race-line-tv" }));
    wished.push({ id: "tv", y: y(runs(view.tv)) + 4 });
    texts.tv = `TV ${fromTenths(view.tv)}`;
  }
  if (view.rival !== null) {
    root.append(svg("line", { x1: PLOT.left, y1: y(runs(view.rival)), x2: PLOT.right, y2: y(runs(view.rival)), class: "race-line race-rival", "data-testid": "race-line-rival" }));
    wished.push({ id: "rival", y: y(runs(view.rival)) + 4 });
    texts.rival = `Rival ${fromTenths(view.rival)}`;
  }
  if (view.bestSoFar.length) {
    const pts: string[] = [];
    let last = 0;
    view.bestSoFar.forEach((b, i) => {
      const x = xPlace(b.round, n);
      if (i > 0) pts.push(`${x},${last}`);
      last = y(runs(b.miss));
      pts.push(`${x},${last}`);
    });
    pts.push(`${PLOT.right},${last}`);
    root.append(svg("polyline", { points: pts.join(" "), class: "race-line race-ai", "data-testid": "race-line-ai" }));
    wished.push({ id: "ai", y: last + 4 });
    texts.ai = `AI ${fromTenths(view.bestSoFar[view.bestSoFar.length - 1].miss)}`;
  }

  for (const r of view.rounds) {
    const x = xPlace(r.round, n);
    const mark = svg("g", { "data-testid": "race-mark", "data-round": r.round, "data-kind": markKind(r) });
    if (r.kind === "fitted") {
      const cy = y(runs(r.miss as number));
      mark.append(r.improved ? svg("circle", { cx: x, cy, r: 7, class: "mark-best" }) : svg("circle", { cx: x, cy, r: 6, class: "mark-open" }));
    } else if (r.kind === "pending") {
      continue;                                  // accepted by code, not scored yet: nothing to plot
    } else if (r.kind === "rejected") {
      mark.append(svg("line", { x1: x - 6, y1: LANE - 6, x2: x + 6, y2: LANE + 6, class: "mark-cross" }),
        svg("line", { x1: x + 6, y1: LANE - 6, x2: x - 6, y2: LANE + 6, class: "mark-cross" }),
        svg("text", { x, y: LANE - 12, class: "mark-word", "text-anchor": "middle" }, "rejected"));
    } else {
      mark.append(svg("text", { x, y: LANE + 4, class: "mark-word", "text-anchor": "middle" }, r.kind === "finished" ? "done" : "failed"));
    }
    root.append(mark);
  }

  const placed = endLabels(wished);
  for (const w of wished) {
    root.append(svg("text", { x: PLOT.labelX, y: placed[w.id], class: `race-end race-end-${w.id}` }, texts[w.id]));
  }

  const caption = (view.rounds.length
    ? "Filled dots: a new best. Open dot: no better. ✕: code rejected the proposal. The solid line is the AI's best so far."
    : "The AI made no proposals. The dotted line is the rival's best; the dashed line is the TV projection.")
    + " All scores are on the check seasons.";
  return h("figure", { class: "race-card" },
    h("div", { class: "race-scroll" }, root),
    h("figcaption", {}, caption),
    h("p", { class: "visually-hidden", "data-testid": "race-text" }, raceText(view)));
}

/** The panel saying which candidate model goes forward, chosen on validation, or that the search is still going. */
export function renderChoicePanel(view: FoundView): HTMLElement {
  const v = view.choice;
  const panel = h("div", { class: `choice-panel choice-${v.state}${v.chosen ? ` choice-${v.chosen}` : ""}`, "data-testid": "choice-panel", "data-state": v.state });
  const body = h("p", { "data-testid": "choice-text" }, ...renderSegs(choiceText(v)));
  panel.append(h("p", { class: "choice-kicker" }, v.state === "pending" ? "Choosing on validation" : "Chosen on validation"),
    h("p", { class: "choice-big", "data-testid": "choice-heading" }, choiceHeading(v)), body);
  if (v.state !== "pending") {
    panel.append(h("p", { class: "small" }, "Chosen before the final test season was touched. Both candidate models still sit the final test."),
      h("p", { "data-testid": "to-final" }, h("a", { href: "#final-test" }, "See the Hold-Out Test for the verdict →")));
  }
  return panel;
}

export function renderRace(view: FoundView): Node[] {
  const chart = renderRaceChart(view);
  return [h("div", { class: "race-layout" }, ...(chart ? [chart] : []), renderChoicePanel(view))];
}
