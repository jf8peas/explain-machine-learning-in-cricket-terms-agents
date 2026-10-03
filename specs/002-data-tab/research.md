# Research: Data Tab

Date: 2026-10-03. Sizes were measured by bundling each library's JS entry with esbuild (`--bundle --minify`, ESM, CSS excluded) in a scratch project. Versions and licences come from `npm view`. Feature claims come from the packages' own source and types; items not yet proven in a running page are listed under "To verify in the spike".

## Decision 1: Grid library

**Decision**: Tabulator (`tabulator-tables` 6.x, MIT) with `@types/tabulator-tables` for types, wrapped by `<data-grid>`.

**Candidates**

| | Tabulator 6.6.1 | RevoGrid 4.28.2 | AG Grid Community 36.2.0 |
|---|---|---|---|
| Framework-free + TS types | Yes. Types come from the separate `@types/tabulator-tables` (6.3.6, MIT) | Yes (Stencil web component). Types bundled | Yes. Types bundled |
| Licence / maintenance | MIT; last published 2026-09-30 | MIT; last published 2026-09-27 | MIT (Community); last published 2026-09-16 |
| Bundle (min / gzip, JS only) | 457 KB / 105 KB (all modules; a custom module set will be smaller, measure in spike) | 362 KB / 106 KB for the loader only. Component chunks load lazily, so the real total is higher and was not measured | 1,136 KB / 319 KB (all community modules) |
| Row virtualisation | Yes (`renderVertical: "virtual"`) | Yes | Yes |
| Sticky header, row-number column, resize | Yes (row header with `rownum`, frozen header, `resizable`) | Yes (`rowHeaders`, resize) | Yes (row numbers need a custom column) |
| Click-to-sort | Yes, but only asc/desc (no "original order" third state) | Yes | Yes |
| Cell and range selection with copy | Yes, in the free build (`selectableRange`, clipboard module, TSV copy) | Yes (range selection, copy and paste) | **No.** Range selection and clipboard are Enterprise-only (paid) |
| Read-only | Yes (cells not editable unless `editor` is set) | Yes (`readonly`) | Yes |
| Spreadsheet look; light/dark via page CSS variables | Gap: theme CSS is compiled from SCSS and has no CSS custom properties. Covered by our own override stylesheet that maps `.tabulator*` classes to the page variables | Good: exposes CSS custom properties | Theming API, not plain page variables |
| Keyboard use | Yes (range navigation, arrow keys, Ctrl+C) | Yes | Yes |

**Rejected without measuring**: Handsontable (not free for public use: custom licence, commercial licence required), Glide Data Grid (React-based), Grid.js and simple-datatables (no virtualisation, no range selection).

**Rationale**: Tabulator is the only candidate that meets every criterion in the free build and is framework-free. AG Grid fails the selection/copy criterion. RevoGrid is the runner-up: it meets the criteria and has better theming, but its lazily loaded chunks and Stencil runtime are harder to size and bundle on Vercel, and its Stencil loader adds a registration step to every app that reuses the component. Because the library sits behind `<data-grid>` and one adapter file, it can be swapped for RevoGrid later.

**Gaps and how they are covered**

- *Sort has no "original order" state, and filtering needs to feed the download*: sorting and filtering are done by our own pure functions (see Decision 3), and the library only renders the rows it is given. Its built-in sort and filter UI are switched off.
- *Theme CSS has no custom properties*: our own stylesheet overrides the structural Tabulator classes, so light and dark follow the page's `--bg`, `--surface`, `--border`, `--text` and `--accent` (with `--dg-*` hooks and fallbacks so other apps can restyle it).
- *Types are a separate package*: `@types/tabulator-tables` is a dev dependency.

**To verify in the spike (first implementation task)**: range copy pastes as clean tab-separated text without the row-number column and with headings only if wanted; the row-number column stays frozen on horizontal scroll; the grid renders correctly when first shown after being hidden (needs `redraw`); keyboard range selection and Ctrl+C work; 5,146 rows scroll smoothly. If any check fails and cannot be covered in the wrapper, switch to RevoGrid.

## Decision 2: Keep panels hidden, not removed

**Decision**: Both panels stay in the DOM; the inactive panel gets the `hidden` attribute. `<tab-set>` never moves or re-creates panels.

**Rationale**: `<graph-replay>` holds a running fetch, buffered events and playback state, so it must not be re-created. A hidden element keeps all JavaScript state.

**Known browser behaviour**: scroll offsets and measured sizes of an element are lost while it is `display: none`. `<tab-set>` therefore dispatches `tab-hide` (before hiding) and `tab-show` (after showing) events. `<data-grid>` saves its scroll offsets on hide, then on show calls the library's redraw and restores the offsets. Tabulator also needs a redraw when it was created while hidden (the #data direct-open case creates it while Data is visible, but a Back navigation can show it later).

## Decision 3: Sort and filter in our own pure code

**Decision**: A pure module (`table-view.ts`) takes rows, columns and view state (search, filters, sort) and returns the ordered rows to show. The adapter renders exactly that array, and the CSV generator receives exactly that array.

**Rationale**: The spec requires the three-state sort (ascending, descending, original), the displayed-text search, and "rows shown, in the order shown" for the download. Doing this once in pure code means the download and the grid cannot disagree, it is unit-testable in Vitest, and a library swap cannot change behaviour. 5,146 rows filter and sort in a few milliseconds in the browser, well inside the 200 ms goal. The user's instruction to prefer the library's filtering only applies if it fits; here it does not (no third sort state, and the download needs the same result).

## Decision 4: Data endpoint shape

**Decision**: `GET /api/data` returns `{columns, rows, summary}`. Rows are arrays of values in column order (smaller than objects, roughly half the JSON size for 5,146 rows). Rows hold raw values; column definitions carry optional `labels` (for example `t20i` to "T20 International", `training` to "Training") so the grid, search and CSV all use display text while the data still equals `innings.csv`.

**Rationale**: Keeps `/api/data` rows identical to `innings.csv` (a direct pytest comparison) and keeps the "Used for" value computed server-side by `season_split.split_by_year`. Filters are declared on column definitions (`filter: "select"` or `"year"`), so the viewer needs no cricket knowledge. The summary is a generic structure (headline figures, titled sections of label/value rows, attribution, file name stem and date) built from `manifest.json`, so "exclusions" is just a section titled by the backend.

**Caching**: The data changes only with a deploy, so the response gets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Vercel compresses JSON responses.

## Decision 5: CSV generation

**Decision**: Own code in `csv.ts`: UTF-8 with a byte-order mark, CRLF line endings, a header row of friendly headings, fields quoted when they contain a comma, quote, CR or LF (quotes doubled), display labels applied, dates as `YYYY-MM-DD`, numbers unformatted. File name `<stem>-<download date>.csv` from the summary (`t20-first-innings-2026-10-01.csv`). Download uses a `Blob` and a temporary object URL.

**Rationale**: Matches the clarified spec and the user's instruction; the byte-order mark makes Excel read UTF-8 venue names correctly.

## Decision 6: Row counts agree

**Decision**: The summary total comes from `manifest.json` (`counts.total_innings`); the grid total is `rows.length`; the agent's `load_data` step uses the row count of the same CSV. A pytest asserts all three are equal, and a Playwright check compares the displayed "Showing X of Y" with the load_data step event.

## Decision 7: Loading and routing

**Decision**: `page/data-tab.ts` fetches `/api/data` the first time the Data tab becomes active (including a page load at `#data`), keeps the result in memory, and shows a loading state, then the grid, or an error with a Retry button. A failed load never touches the Working tab. Tab changes set `location.hash` (one history step per real change); `hashchange` selects the tab; an unknown or empty hash shows Working and uses `replaceState`, adding no history step.

## Spike and measurement results (recorded during implementation)

The spike was folded into the real implementation instead of a throwaway page: the adapter was built first and the checks became Playwright tests in `web/tests/e2e/data-tab.spec.ts`. Tabulator passed every one, so RevoGrid was not needed.

| Check | Result |
|---|---|
| Range copy pastes as clean tab-separated display text without row numbers | Pass (clipboard test with the full competition name) |
| Row-number column stays at the left edge when scrolled right | Pass |
| Grid renders correctly when first created at `#data` and after a tab switch (redraw, scroll restore) | Pass |
| Keyboard: arrow keys move the selected cell, Ctrl+C copies it | Pass |
| Row virtualisation | Pass: about 40 rows in the DOM out of 5,146 |
| Scrolling 5,146 rows | 60 fps (median and 95th-percentile frame 16.7 ms) |
| Sort, search, clear over all rows | 43 to 68 ms from input to painted result |
| Light and dark appearance | Checked by screenshot; selected ranges needed colour overrides (Tabulator hard-codes light colours for them) |

Findings that changed the code:

- Tabulator sets its own element's height, which overrode the CSS height and made every row render (about 20 s to show the grid). The adapter now gives it a child element that fills the container's CSS height.
- With header-click range selection switched on, a heading click would select a column instead of sorting, so column selection is off; sorting is ours (three states).
- After a keyboard sort the library moves focus to its scroll area, so the adapter puts focus back on the heading.
- Sizes: the production build splits the Data code into its own lazy chunk of 478 KB (113 KB gzipped) with the Tabulator CSS (28 KB, 4 KB gzipped); the main page script is 71 KB (25 KB gzipped) and does not grow. `TabulatorFull` (all modules) is used; trimming to a custom module set is possible later if size matters.
- `/api/data` is 518 KB of JSON before compression, about 79 KB gzipped (the plan's early estimate of 350 KB was too low).

## Open questions

None remaining. The spike checks in Decision 1 are verification work, not undecided choices.
