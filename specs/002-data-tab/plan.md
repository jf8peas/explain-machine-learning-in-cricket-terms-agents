# Implementation Plan: Data Tab

**Branch**: `002-data-tab` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification plus the technical decisions supplied with `/speckit-plan`.

## Summary

Add Working and Data tabs to the linear regression app. A new `GET /api/data` returns the innings table, column definitions and a manifest summary, with the "Used for" value computed by the existing `season_split` module. A generic `<tab-set>` shows one panel at a time by hiding, never re-creating, panels, so a run in progress, its results and the grid state survive switching. A generic `<data-grid>` shows a spreadsheet-style read-only grid, summary, column guide, search and filters, and a CSV download. It wraps one grid library (Tabulator, chosen in [research.md](research.md)) behind a single adapter file. Sorting, filtering and CSV generation are our own pure code, so the download always matches what is shown. Both components sit beside `graph-replay` as bounded modules with no cricket or regression knowledge.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web)
**Primary Dependencies**: existing FastAPI, pandas; new web dependency `tabulator-tables` 6.x (MIT) and dev dependency `@types/tabulator-tables`. No new Python dependencies
**Storage**: Existing committed `data/innings.csv` and `data/manifest.json` only. No database; data held in browser memory after first fetch
**Testing**: pytest, Vitest, Playwright (existing setup)
**Target Platform**: Vercel (static plus Python function); evergreen browsers
**Project Type**: Web app inside the uv-workspace monorepo (same as 001)
**Performance Goals**: Sort, search and filter over 5,146 rows well under 200 ms; smooth scroll (virtualised rows); `/api/data` payload about 520 KB of JSON, about 80 KB gzipped
**Constraints**: Working tab never waits on the data fetch; existing components and `data-testid`s unchanged; page never scrolls sideways; CSV opens in Excel (UTF-8 with byte-order mark)
**Scale/Scope**: About 5,100 rows, 10 columns, read-only, public traffic

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief instead: reusable modules stay free of app knowledge (FR-021), the split is never reimplemented in the browser (FR-013), existing behaviour and tests are untouched.

**Re-check after design**: no violations. `<graph-replay>`, the results card, try-your-own and all current `data-testid`s are unchanged; `index.html` only gains tab wrappers around existing sections.

## Project Structure

### Documentation (this feature)

```text
specs/002-data-tab/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── data-api.md
└── checklists/
    └── requirements.md
```

### Source Code (additions and changes under `apps/linear_regression/`)

```text
backend/linreg/
├── data_api.py            # NEW, shared-library candidate: router factory for GET /data, takes
│                          #   a table builder; JSON-safe, DataError to 500 with message
├── data_table.py          # NEW, app-specific: builds columns, rows (+ used_for via
│                          #   split_by_year) and summary from innings.csv and manifest.json
api/index.py               # CHANGED: include the data router under /api
vercel.json                # CHANGED: cache header for /api/data
tests/
├── test_data_api.py       # NEW: pytest (see Testing Strategy)
web/
├── package.json           # CHANGED: tabulator-tables, @types/tabulator-tables
├── index.html             # CHANGED: wrap existing sections in <tab-set> panels, add Data panel
├── src/
│   ├── page/
│   │   ├── main.ts        # CHANGED: import new modules, wire data-tab
│   │   └── data-tab.ts    # NEW, app glue: lazy fetch on first show, loading/error/retry
│   ├── tab-set/           # NEW, shared-library candidate
│   │   ├── tab-set.ts     #   custom element, ARIA tabs, hash routing, tab-hide/tab-show
│   │   └── README.md
│   └── data-grid/         # NEW, shared-library candidate
│       ├── data-grid.ts   #   custom element: toolbar, summary, guide, states, download menu
│       ├── grid-adapter.ts#   the ONLY file that imports tabulator-tables
│       ├── table-view.ts  #   pure: search, filters, three-state sort, year/label helpers
│       ├── csv.ts         #   pure: CSV text, file name
│       ├── types.ts       #   ColumnDef, DataTable, DataSummary, ViewState
│       ├── styles.ts      #   spreadsheet look using --dg-* variables with page fallbacks
│       └── README.md
└── tests/
    ├── unit/
    │   ├── table-view.test.ts
    │   └── csv.test.ts
    └── e2e/
        └── data-tab.spec.ts
```

**Structure decision**: The two new web modules mirror `graph-replay` (own folder, README, no imports from `page/`). `grid-adapter.ts` keeps the library swappable. `page/data-tab.ts` is the only place that knows the URL and the app's data endpoint.

## Design Notes

### Backend

- `data_table.build_table()` reads the CSV with the existing `load_innings`, calls `split_by_year`, and marks each row `test` or `training`. Row order and raw values match the CSV. Column definitions are declared once in `data_table.py` (see data-model.md).
- The summary is built from `manifest.json`: total, per-competition counts, summed exclusion reasons (zero counts omitted), date range, download date, attribution.
- `data_api.create_router(build_table)` serves `GET /data`; the app mounts it with `prefix="/api"`. A `DataError` becomes HTTP 500 with a plain-English message. The router sets the cache header.

### Tabs

- `<tab-set>` reads `data-tab` / `data-label` from its children, builds the tab list, and toggles `hidden` on panels. Panels are never moved, cloned or re-created.
- Selecting a tab sets `location.hash` when it differs (one history step); `hashchange` selects the tab for Back/Forward and direct links; an unknown or empty hash selects Working with `replaceState`.
- Keyboard: Left/Right (wrapping), Home and End move focus and select; only the selected tab is in the tab order.
- Emits `tab-hide` before hiding and `tab-show` after showing so panels can save and restore scroll and redraw.

### Grid

- `data-grid.ts` owns the toolbar, summary, column guide, "Showing X of Y innings", empty state and download menu. It computes `visibleRows` through `table-view.ts` on every view-state change and hands the result to `grid-adapter.ts`.
- The adapter configures Tabulator: virtual rendering, read-only cells, range selection with clipboard copy of the range (cells only, tab-separated), resizable columns, frozen row-number column built from the row's position in `visibleRows`, header-click sorting reported back to `data-grid.ts` (the library's own sort is off, so the three-state cycle and original order are ours), and keyboard navigation.
- Number columns are right-aligned; competition and Used-for show their `labels`. Hover/focus text uses `description`. The guide lists every column's label and description.
- Header, row-number column, selected-cell highlight and gridlines are styled with our own CSS against `--dg-*` variables defaulting to the page's `--bg`, `--surface`, `--border`, `--text`, `--accent`, so light and dark work without extra code.
- The grid lives in its own scroll container (`overflow: auto`, `max-width: 100%`), so the page never scrolls sideways.

### Download

- "Download CSV" downloads all rows directly when no filter, search or sort is active. When any is active, the same control opens a two-item menu: "All rows" and "Rows shown (N)"; the second is disabled when N is zero.
- `csv.ts` builds the text (byte-order mark, CRLF, quoting, labels, dates as `YYYY-MM-DD`) from `columns` and the chosen row array; the file name is `<file_stem>-<file_date>.csv`.
- The attribution sits beside the button and at the foot of the Data tab.

### Loading and states

- `page/data-tab.ts` listens for `tab-show` on the Data panel (and checks the initial hash), fetches `/api/data` once, and sets `data-grid.table`. While loading it calls `setLoading()`; on failure `setError(message)`, and the `retry` event refetches. Nothing else on the page waits on this.
- Empty result: message plus "Clear filters"; "Rows shown" disabled.

### Dependency and bundle

`tabulator-tables` is imported only in `grid-adapter.ts`, and the Data tab code is loaded with a dynamic `import()` the first time Data is shown (or at `#data`), so the Working tab's initial load does not grow. Register only the Tabulator modules needed to keep the bundle small (measured in the spike).

## Testing Strategy

- **pytest** (`tests/test_data_api.py`): `/api/data` rows equal `innings.csv` row for row; `used_for` agrees with `split_by_year` (latest year is test, earlier is training); training and test counts equal the split's counts; summary total, `len(rows)` and `load_data` row count agree; `rows[i]` length equals column count; a missing data file returns a 500 with a message; venue names with commas and quotes survive JSON.
- **Vitest**: `table-view.test.ts` covers search on displayed text (including full competition names, case-insensitive), the competition, year and Used-for filters combined, the three-state sort (numeric, date, text, return to original order) and the order passed to the download. `csv.test.ts` covers quoting of a venue with a comma, quotes and a line break, byte-order mark, CRLF, labels, ISO dates, header row, and file name from the summary date.
- **Playwright** (`data-tab.spec.ts`): switching tabs mid-run does not restart the run; a completed run's results, step and try-your-own inputs survive switching; opening `#data` directly shows the grid without a run; Back and Forward move between tabs; sorting a column changes the first row and a third click restores the original; filters and sort survive a tab switch; the downloaded all-rows file has the expected row count and the shown-rows file respects a filter; a failed `/api/data` (route-aborted) shows the message and Retry while Working still works; tabs operate by keyboard and expose `role=tab` with `aria-selected`; the page has no horizontal scroll at phone width.
- **Regression**: all existing pytest, Vitest and Playwright tests keep passing unchanged.

## Risks and the first task

1. **Spike (first task)**: prove the Tabulator items listed in research.md ("To verify in the spike") in a throwaway page before building the rest. If a check fails and the wrapper cannot cover it, switch to RevoGrid; only `grid-adapter.ts` and `styles.ts` change.
2. **Hidden-panel layout**: grids sized while hidden render at zero height; covered by the `tab-show` redraw and scroll restore, with a Playwright test.
3. **Scroll position across tabs**: browsers drop scroll offsets for `display: none` elements; covered by save and restore in `data-grid`.

## Complexity Tracking

No constitution gates, so nothing to justify. One deliberate extra: sorting and filtering are written ourselves rather than using the library's, because the spec needs a three-state sort and a download that matches the view exactly (research.md, Decision 3).
