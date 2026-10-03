# `<data-grid>`

A framework-free web component that shows any table as a read-only, spreadsheet-style grid with a summary, column guide, search, filters, a count and a CSV download. It knows nothing about the data: it is driven only by columns, rows and a summary.

```html
<data-grid noun="rows"></data-grid>
<script type="module">
  import "./data-grid/data-grid.ts";
  document.querySelector("data-grid").table = await (await fetch("/api/data")).json();
</script>
```

## Input (`table`)

`{ columns, rows, summary }`, see `types.ts` and `specs/002-data-tab/contracts/data-api.md`.

- **columns**: `key`, `label` (heading), `description` (hover, focus and the column guide), `type` (`text`, `integer`, `number`, `date`), optional `labels` (display text for raw values) and `filter` (`select`, or `year` for a `date` column).
- **rows**: arrays of raw values in column order; their order is the "original order".
- **summary**: headline figures, titled sections, an attribution note, and the file name stem and date for downloads.

## Attributes, methods, events

| Name | Meaning |
|---|---|
| `noun` | what a row is called in "Showing X of Y …" (default `rows`) |
| `table` | set the table (renders; resets search, filters and sort) |
| `setLoading()` / `setError(message)` | show the loading or failure state |
| `retry` event | the visitor pressed "Try again" in the failure state |

If the element sits inside a `<tab-set>`, it saves its scroll offsets when its tab is hidden and redraws and restores them when shown again.

## Behaviour

Sticky header and row-number column (numbered over the rows shown), gridlines, compact rows, right-aligned numbers, a highlighted selected cell and range, resizable columns, arrow-key movement, Ctrl+C copy of a range (tab-separated display text, no row numbers), read-only. Headings sort ascending, descending, then original order (click, or Enter/Space when focused); a focused heading shows its meaning. Search matches the displayed text of any column, ignoring case and surrounding spaces. "Download CSV" downloads every row directly when nothing is active; otherwise it offers "All rows" or "Rows shown" (in the order shown). The CSV has a byte-order mark, CRLF line endings, friendly headings and display labels, and quotes fields containing commas, quotes or line breaks.

## Files

| File | Role |
|---|---|
| `data-grid.ts` | the custom element (summary, guide, toolbar, states, download menu) |
| `grid-adapter.ts` | the **only** file that imports the grid library (Tabulator). Swap the library here |
| `table-view.ts` | pure: search, filters, three-state sort, filter options (unit-tested) |
| `csv.ts` | pure: CSV text and file name (unit-tested), plus the browser download |
| `types.ts` | `ColumnDef`, `DataTable`, `DataSummary`, `ViewState` |
| `styles.ts` | spreadsheet look, using `--dg-*` variables that default to the page's `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent` |

Sorting and filtering are done in `table-view.ts` (not by the library), so the CSV download always receives exactly the rows and order on screen. The grid is rendered in light DOM, because the library needs document-level styles.
