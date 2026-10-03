// The ONLY file that imports the grid library (Tabulator). Everything else talks to this small interface,
// so the library can be swapped without touching <data-grid>.
import { TabulatorFull as Tabulator, type ColumnDefinition } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import { displayText } from "./table-view";
import type { ColumnDef, SortState, Value } from "./types";

export interface GridCallbacks {
  /** A heading was clicked, or Enter/Space pressed on it. */
  onHeaderActivate(key: string): void;
  /** A heading gained focus (key) or focus left the headings (null). */
  onHeaderFocus(key: string | null): void;
}

export interface GridAdapter {
  setRows(rows: Value[][]): void;
  setSort(sort: SortState): void;
  redraw(): void;
  getScroll(): { top: number; left: number };
  setScroll(pos: { top: number; left: number }): void;
  destroy(): void;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function createGrid(container: HTMLElement, columns: ColumnDef[], cb: GridCallbacks): GridAdapter {
  const numeric = (c: ColumnDef) => c.type === "integer" || c.type === "number";
  const defs: ColumnDefinition[] = columns.map((c) => ({
    title: c.label,
    field: c.key,
    hozAlign: numeric(c) ? "right" : "left",
    headerHozAlign: numeric(c) ? "right" : "left",
    headerSort: false, // sorting is ours (three states), reported through the callbacks
    resizable: true,
    headerTooltip: c.description,
    // Cells show the display label; a copied cell carries the same text.
    formatter: c.labels ? (cell) => escapeHtml(displayText(c, cell.getValue() as Value)) : undefined,
    accessorClipboard: (value: unknown) => displayText(c, value as Value),
  }));

  let pending: Record<string, Value>[] = [];
  let built = false;
  let sort: SortState = null;
  let refocusKey: string | null = null; // a keyboard sort redraws the rows; put focus back on the heading

  // Tabulator takes over its element's height, so it gets a child that fills the container's CSS height.
  const host = document.createElement("div");
  host.style.height = "100%";
  container.append(host);
  const table = new Tabulator(host, {
    data: [],
    columns: defs,
    height: "100%",
    layout: "fitData",
    renderVertical: "virtual",
    renderVerticalBuffer: 400,
    movableColumns: false,
    rowHeader: { formatter: "rownum", headerSort: false, hozAlign: "right", resizable: false, frozen: true, width: 56, minWidth: 56 },
    selectableRange: true,
    selectableRangeRows: true,
    selectableRangeColumns: false, // heading clicks sort; they do not select a column
    clipboard: "copy",
    clipboardCopyRowRange: "range",
    clipboardCopyStyled: false,
    clipboardCopyConfig: { columnHeaders: false, rowHeaders: false, rowGroups: false, columnCalcs: false, dataTree: false, formatCells: false },
    placeholder: "",
  });

  const headerEls = () => [...container.querySelectorAll<HTMLElement>(".tabulator-col[tabulator-field]")];

  function decorateHeaders() {
    for (const el of headerEls()) {
      const key = el.getAttribute("tabulator-field")!;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      el.tabIndex = 0;
      el.title = col.description;
      el.setAttribute("aria-description", col.description);
      el.setAttribute("aria-sort", sort && sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
      if (el.dataset.dgBound) continue;
      el.dataset.dgBound = "1";
      el.addEventListener("focus", () => cb.onHeaderFocus(key));
      el.addEventListener("blur", () => cb.onHeaderFocus(null));
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          refocusKey = key;
          cb.onHeaderActivate(key);
        }
      });
    }
  }

  table.on("tableBuilt", () => {
    built = true;
    table.setData(pending);
    decorateHeaders();
  });
  table.on("headerClick", (_e, column) => {
    const key = column.getField();
    if (key) cb.onHeaderActivate(key);
  });
  table.on("renderComplete", decorateHeaders);

  function restoreHeaderFocus() {
    if (!refocusKey) return;
    const key = refocusKey;
    refocusKey = null;
    headerEls().find((h) => h.getAttribute("tabulator-field") === key)?.focus();
  }

  const holder = () => container.querySelector<HTMLElement>(".tabulator-tableholder");

  return {
    setRows(rows) {
      pending = rows.map((row) => Object.fromEntries(columns.map((c, i) => [c.key, row[i]])));
      if (built) void table.setData(pending).then(() => requestAnimationFrame(restoreHeaderFocus));
    },
    setSort(next) {
      sort = next;
      if (built) decorateHeaders();
    },
    redraw() {
      if (built) table.redraw(true);
    },
    getScroll() {
      const h = holder();
      return { top: h?.scrollTop ?? 0, left: h?.scrollLeft ?? 0 };
    },
    setScroll(pos) {
      const h = holder();
      if (h) {
        h.scrollTop = pos.top;
        h.scrollLeft = pos.left;
      }
    },
    destroy() {
      table.destroy();
      host.remove();
    },
  };
}
