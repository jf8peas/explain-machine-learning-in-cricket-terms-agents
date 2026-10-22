// The Scorebook (app-specific): the full reference views for data scientists, never inline. Four cards. Every model tried (the ranked
// list and the brute-force search's two grids) and The data (the data grid, fetched only when first opened) open in one full-width
// panel below the cards, one at a time, with a close button that returns focus to its card. The agent graph card opens the full
// graph in Watch it think and scrolls to it. How this app was built is a link. Everything here is the run's own data.
import "../data-grid/data-grid";
import type { DataGrid } from "../data-grid/data-grid";
import { syncToggles } from "../detail-level/detail-level";
import { h } from "./dom";
import { renderGrid } from "./found/grid";
import { renderRanking } from "./found/ranking";
import { buildView } from "./found/view";
import type { RunInfo } from "./run-source";

export const KICKER = "THE SCOREBOOK";
export const HEADING = "For the data scientists: every detail.";
export type PanelId = "models" | "data";

const DATA_INTRO = "Every row is one real first innings. The agent reads these rows, learns from the earlier years (Training), chooses clues on the check seasons (Validation) and is marked once on the latest year (Test). Sort, search and filter them, copy cells into a spreadsheet, or download the lot.";

export interface Scorebook {
  /** Open a panel (as the old #data link does). */
  open(panel: PanelId): void;
  /** The run on the page changed: redraw an open panel from it. */
  refresh(): void;
}

interface Card { id: string; testid: string; title: string; line: string }

const CARDS: Card[] = [
  { id: "models", testid: "scorebook-card-models", title: "Every model tried", line: "Every idea, ranked, and the search's grids." },
  { id: "graph", testid: "scorebook-card-graph", title: "The agent graph, step by step", line: "Each step of the agent, one at a time." },
  { id: "data", testid: "scorebook-card-data", title: "The data", line: "Every innings, to sort, filter and download." },
];

export function setupScorebook(root: HTMLElement, getRun: () => RunInfo | null): Scorebook {
  let openId: PanelId | null = null;
  let grid: DataGrid | null = null;
  let dataStarted = false;
  const cardEls = new Map<string, HTMLElement>();

  const panel = h("div", { class: "sb-panel", id: "scorebook-panel", "data-testid": "scorebook-panel", role: "region", "aria-label": "Scorebook", hidden: "" });
  const close = h("button", { type: "button", class: "toggle sb-close", "data-testid": "scorebook-close" }, "Close");
  const body = h("div", { class: "sb-body" });
  panel.append(close, body);

  function drawModels() {
    const state = getRun()?.state ?? {};
    const view = buildView(state);
    body.replaceChildren(
      h("section", { class: "sb-section", "data-testid": "scorebook-models" },
        h("h3", {}, "The brute-force search: trying every combination"), ...renderGrid(view)),
      h("section", { class: "sb-section" }, h("h3", {}, "Every candidate model tried, ranked"), ...renderRanking(view)));
  }

  function drawData() {
    if (!grid) {
      grid = document.createElement("data-grid") as DataGrid;
      grid.setAttribute("noun", "innings");
    }
    body.replaceChildren(h("p", { class: "muted data-intro" }, DATA_INTRO), grid);
    if (!dataStarted) {                                                         // /api/data is fetched on first open, and only then
      dataStarted = true;
      void import("./data-tab").then((m) => m.init(grid as DataGrid));
    }
  }

  function setOpen(next: PanelId | null, focusCard = false) {
    const previous = openId;
    openId = next;
    for (const [id, el] of cardEls) {
      el.setAttribute("aria-expanded", String(id === next));
      el.classList.toggle("is-open", id === next);
    }
    panel.hidden = next === null;
    if (next === "models") drawModels();
    else if (next === "data") drawData();
    else body.replaceChildren();
    if (next === null && focusCard && previous) cardEls.get(previous)?.focus();
  }

  function openGraph() {
    const toggle = document.querySelector<HTMLElement>("[data-testid=graph-toggle]");
    if (toggle) { toggle.dataset.open = "true"; syncToggles(); }
    const target = document.getElementById("graph-panel");
    target?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  const cards = CARDS.map((c) => {
    const el = h("button", { type: "button", class: "sb-card", "data-testid": c.testid, "aria-controls": "scorebook-panel", ...(c.id === "graph" ? {} : { "aria-expanded": "false" }) },
      h("strong", {}, c.title), h("span", {}, c.line));
    el.addEventListener("click", () => {
      if (c.id === "graph") return openGraph();
      setOpen(openId === c.id ? null : (c.id as PanelId));
    });
    if (c.id !== "graph") cardEls.set(c.id, el);
    return el;
  });
  const built = h("a", { class: "sb-card", href: "/under-the-hood.html", "data-testid": "scorebook-card-built" },
    h("strong", {}, "How this app was built"), h("span", {}, "The agent, the data and the page."));
  close.addEventListener("click", () => setOpen(null, true));
  panel.addEventListener("keydown", (ev) => { if ((ev as KeyboardEvent).key === "Escape") setOpen(null, true); });

  root.replaceChildren(
    h("p", { class: "kicker" }, KICKER),
    h("h2", { id: "scorebook-title" }, HEADING),
    h("div", { class: "sb-cards", "data-testid": "scorebook-cards" }, ...cards, built),
    panel);

  return {
    open: (id) => setOpen(id),
    refresh() { if (openId === "models") drawModels(); },
  };
}
