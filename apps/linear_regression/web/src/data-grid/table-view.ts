// Pure view logic: what rows to show, in what order. The grid renders exactly this array and the
// CSV download receives exactly this array, so the two can never disagree.
import type { ColumnDef, DataTable, SortState, Value, ViewState } from "./types";

/** The text a cell displays (and what search, sort of text and the CSV use). */
export function displayText(col: ColumnDef, v: Value): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return col.labels?.[s] ?? s;
}

/** The calendar year of an ISO date (YYYY-MM-DD); empty if there is none. */
export function yearOf(v: Value): string {
  const m = /^(\d{4})-/.exec(String(v ?? ""));
  return m ? m[1] : "";
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Options for a filter column: distinct display values (select) or years, newest first (year). */
export function filterOptions(table: DataTable, col: ColumnDef): FilterOption[] {
  const at = table.columns.indexOf(col);
  const seen = new Set<string>();
  for (const row of table.rows) {
    const raw = col.filter === "year" ? yearOf(row[at]) : row[at] === null ? "" : String(row[at]);
    if (raw) seen.add(raw);
  }
  const options = [...seen].map((value) => ({ value, label: col.filter === "year" ? value : displayText(col, value) }));
  return col.filter === "year"
    ? options.sort((a, b) => Number(b.value) - Number(a.value))
    : options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Click cycle for a heading: ascending, then descending, then original order. */
export function nextSort(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

export function isViewActive(view: ViewState): boolean {
  return view.search.trim() !== "" || view.sort !== null || Object.values(view.filters).some((v) => v !== "");
}

export function isFiltered(view: ViewState): boolean {
  return view.search.trim() !== "" || Object.values(view.filters).some((v) => v !== "");
}

// Lower-cased displayed text per row, computed once per table.
const haystacks = new WeakMap<DataTable, string[]>();
function haystackFor(table: DataTable): string[] {
  let h = haystacks.get(table);
  if (!h) {
    h = table.rows.map((row) => table.columns.map((c, i) => displayText(c, row[i])).join("\u0001").toLowerCase());
    haystacks.set(table, h);
  }
  return h;
}

const isEmpty = (v: Value) => v === null || v === "";

function compare(col: ColumnDef, a: Value, b: Value): number {
  if (col.type === "integer" || col.type === "number") return Number(a) - Number(b);
  if (col.type === "date") return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  return displayText(col, a).localeCompare(displayText(col, b));
}

export function visibleRows(table: DataTable, view: ViewState): Value[][] {
  const term = view.search.trim().toLowerCase();
  const haystack = term ? haystackFor(table) : null;
  const active = table.columns
    .map((col, at) => ({ col, at, want: view.filters[col.key] ?? "" }))
    .filter((f) => f.want !== "" && f.col.filter);

  let rows: Value[][] = [];
  table.rows.forEach((row, i) => {
    if (haystack && !haystack[i].includes(term)) return;
    for (const f of active) {
      const have = f.col.filter === "year" ? yearOf(row[f.at]) : row[f.at] === null ? "" : String(row[f.at]);
      if (have !== f.want) return;
    }
    rows.push(row);
  });

  if (view.sort) {
    const at = table.columns.findIndex((c) => c.key === view.sort!.key);
    if (at >= 0) {
      const col = table.columns[at];
      const sign = view.sort.dir === "asc" ? 1 : -1;
      // Array.prototype.sort is stable, so ties keep their original order.
      rows = [...rows].sort((a, b) => {
        const aEmpty = isEmpty(a[at]);
        const bEmpty = isEmpty(b[at]);
        if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1; // empty values stay last either way
        return sign * compare(col, a[at], b[at]);
      });
    }
  }
  return rows;
}
