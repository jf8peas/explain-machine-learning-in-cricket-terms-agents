# Tasks: Data Tab

**Input**: Design documents in `specs/002-data-tab/` (plan.md, spec.md, research.md, data-model.md, contracts/data-api.md, quickstart.md)
**Tests**: Included. The plan's Testing Strategy asks for pytest, Vitest and Playwright tests.
**Paths**: Relative to `apps/linear_regression/` unless they start with `specs/`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story label (US1 to US7), used only in story phases

## Phase 1: Setup

- [x] T001 Add `tabulator-tables` (dependency) and `@types/tabulator-tables` (dev dependency) in `web/package.json` and refresh `web/package-lock.json` (reversible: if T003 fails and RevoGrid is chosen, replace these with `@revolist/revogrid`)
- [x] T001a Baseline before any edit (kept the existing uncommitted edits as they were; baseline was 71 pytest, 36 Vitest, 25 Playwright, all passing): confirm the working tree's uncommitted changes to `web/index.html`, `web/src/graph-replay/styles.ts` and `web/tests/e2e/structure.spec.ts` are committed, stashed or deliberately kept, then run the existing pytest, Vitest and Playwright suites and record that they pass
- [x] T002 [P] Create empty module folders with README stubs: `web/src/tab-set/README.md` and `web/src/data-grid/README.md` (each states: takes only columns, rows and a summary; no cricket or regression knowledge)
- [x] T003 (done as part of the real implementation, see research.md "Spike and measurement results"; all checks passed, Tabulator kept) Spike: in a throwaway page (not committed, under the scratchpad), prove Tabulator against the "To verify in the spike" list in `specs/002-data-tab/research.md`: range copy pastes clean TSV without the row-number column, frozen row-number column on horizontal scroll, correct render when first shown after being hidden (redraw), keyboard range selection and Ctrl+C, smooth scroll over 5,146 rows. Record pass/fail and the measured size of the module set actually needed in `specs/002-data-tab/research.md`. If a check fails and cannot be covered in the wrapper, stop and switch to RevoGrid before continuing

**Checkpoint**: Library choice confirmed.

## Phase 2: Foundational (blocks all user stories)

- [x] T004 [P] Define the generic types `ColumnDef`, `DataTable`, `DataSummary`, `ViewState` in `web/src/data-grid/types.ts` per `specs/002-data-tab/data-model.md`
- [x] T005 [P] Write failing pytest tests for the endpoint in `tests/test_data_api.py`: rows equal `data/innings.csv` row for row (raw values, same order) plus `used_for`; every row has one value per column; a venue with a comma, a quote or a non-ASCII character (for example an accented letter) survives JSON; a missing data file returns 500 with a plain-English message
- [x] T006 Implement `backend/linreg/data_table.py`: build columns (data-model.md table), rows from `load_innings`, `used_for` via `split_by_year` (latest calendar year is `test`, earlier is `training`), and the summary from `data/manifest.json` (total, date range, download date, innings per competition, summed exclusion reasons with zero counts omitted, attribution, `file_stem` `t20-first-innings`, `file_date`)
- [x] T007 Implement `backend/linreg/data_api.py`: `create_router(build_table)` serving `GET /data`, converting `DataError` to HTTP 500 with the message, setting `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (this covers local runs)
- [x] T008 Mount the data router in `api/index.py` under `/api` and add the same `/api/data` cache header to `vercel.json` (this covers production); make T005 pass and confirm existing `tests/test_api.py` still passes
- [x] T009 [P] Implement the pure view logic in `web/src/data-grid/table-view.ts`: display text per cell (labels, ISO dates), `visibleRows(table, viewState)` applying search, filters and sort, three-state sort cycle helper, year-from-date helper, distinct filter options per column
- [x] T010 [P] Write Vitest tests for the pure view logic in `web/tests/unit/table-view.test.ts`: search matches displayed text case-insensitively (for example "t20 international") and trims leading and trailing spaces from the term, competition, year and Used-for filters combine with search, numeric/date/text sorting, ascending then descending then original order, stable ties
- [x] T011 [P] Implement `web/src/data-grid/csv.ts`: `toCsv(columns, rows)` (UTF-8 byte-order mark, CRLF, header row of friendly labels, quote fields containing comma, quote, CR or LF with quotes doubled, labels applied, dates `YYYY-MM-DD`, plain numbers) and `csvFileName(summary)` giving `<file_stem>-<file_date>.csv`
- [x] T012 [P] Write Vitest tests in `web/tests/unit/csv.test.ts`: a venue containing a comma, a quote and a line break, and a venue with a non-ASCII character that comes through unchanged; byte-order mark and CRLF present; labels and ISO dates; file name from summary; the order of the passed rows is preserved (the sort order handed to the download)
- [x] T013 Implement `web/src/data-grid/grid-adapter.ts`, the only file importing `tabulator-tables`: create the grid in a container, set rows, read-only, virtual rendering, resizable columns, frozen row-number column numbered 1, 2, 3… over the rows passed in, range selection with TSV clipboard copy, header-click callback (no library sorting), scroll save/restore, `redraw`, `destroy`
- [x] T014 Implement `web/src/data-grid/styles.ts`: spreadsheet look (gridlines, sticky header and row numbers, compact rows, right-aligned numbers, selected-cell highlight) using `--dg-*` variables defaulting to the page's `--bg`, `--surface`, `--border`, `--text`, `--accent`, correct in light and dark; the grid area scrolls inside its own container and never widens the page

**Checkpoint**: Backend serves the data; pure logic, CSV and adapter exist and are tested. User stories can start.

## Phase 3: User Story 1 - Switch between Working and Data without losing my place (P1)

**Goal**: Two tabs, Working default, nothing resets on switching, links and Back work, keyboard and screen-reader support.
**Independent test**: Start a run, switch to Data and back several times; the run continues; `#data` opens Data directly.

- [x] T015 [P] [US1] Write Playwright tests in `web/tests/e2e/data-tab.spec.ts` (tab part): Working selected by default; switching mid-run does not restart the run (step count keeps advancing, no second `/api/run` request); a finished run's results, current step and try-your-own inputs survive repeated switching; `#data` opens Data with no run; Back and Forward move between tabs; unknown hash shows Working without adding a history step; arrow keys, Home and End move between tabs; `role=tab` and `aria-selected` are correct
- [x] T016 [US1] Implement `web/src/tab-set/tab-set.ts`: build the ARIA tab list from children with `data-tab` and `data-label`; toggle `hidden` on panels without moving or re-creating them; set `location.hash` only when it differs; follow `hashchange`; unknown or empty hash selects the default with `replaceState`; roving tabindex; Left/Right (wrapping), Home and End; emit `tab-hide` before hiding and `tab-show` after showing
- [x] T017 [US1] Update `web/index.html`: wrap the existing graph, results and try-your-own sections unchanged inside a `<tab-set>` Working panel, add an empty Data panel, add the tab styles, and keep the footer attribution outside the tabs; do not change any existing `data-testid`
- [x] T018 [US1] Import `tab-set` in `web/src/page/main.ts`; confirm all existing Vitest and Playwright tests still pass
- [x] T019 [P] [US1] Document `<tab-set>` (attributes, events, ARIA behaviour, panel-never-removed rule) in `web/src/tab-set/README.md`

**Checkpoint**: Tabs work with an empty Data panel; existing behaviour intact.

## Phase 4: User Story 2 - Browse the data like a spreadsheet (P1)

**Goal**: Full table in a read-only spreadsheet-style grid with friendly headings, meanings and a column guide.
**Independent test**: Open Data, scroll all rows, select and copy cells.

- [x] T020 [P] [US2] Write Playwright tests in `web/tests/e2e/data-tab.spec.ts` (grid part): `#data` renders the grid with all innings; header and row-number column stay in place while scrolling; competitions show full names; a heading's meaning appears on hover and focus; the column guide lists every column; at phone width the page has no horizontal scroll while the grid scrolls inside itself; a column can be resized; cells cannot be edited
- [x] T021 [US2] Implement `web/src/data-grid/data-grid.ts` core: custom element with the `table` property, container, column guide, label and description handling, wiring to `grid-adapter.ts` and `styles.ts`; no references to cricket or regression
- [x] T022 [US2] Implement `web/src/page/data-tab.ts`: exporting an `init()` that fetches `/api/data` once immediately, keeps it in memory and sets `data-grid.table`; the Working tab never waits on it
- [x] T023 [US2] Add `<data-grid noun="innings">` to the Data panel in `web/index.html`. In `web/src/page/main.ts`, check the hash on load and listen for `tab-show` on the Data panel; import `data-tab` and the grid code with a dynamic `import()` on whichever comes first (so a direct `#data` visit is not missed, and the Working tab's initial load does not grow), then call `init()`
- [x] T024 [US2] Handle hide and show in `web/src/data-grid/data-grid.ts`: find the enclosing element with `data-tab` and react only to `tab-hide` and `tab-show` events whose `detail.id` matches it; on hide save scroll offsets, on show redraw and restore them
- [x] T025 [P] [US2] Document `<data-grid>` (properties, events, the one-adapter rule, theming variables) in `web/src/data-grid/README.md`
- [x] T046 [P] [US2] Write a Playwright test in `web/tests/e2e/data-tab.spec.ts`: column headings are keyboard focusable; focusing a heading shows its meaning; Enter or Space on a focused heading cycles the sort (ascending, descending, original); focus is visibly outlined
- [x] T047 [US2] Make column headings keyboard accessible in `web/src/data-grid/grid-adapter.ts`: focusable headings, Enter or Space triggers the sort callback, heading `title` and a focus-visible description (also exposed through `aria-description` or `aria-sort` as appropriate); make T046 pass
- [x] T048 [P] [US2] Write a Playwright test in `web/tests/e2e/data-tab.spec.ts` with clipboard permission granted: select a range of cells, press Ctrl+C, and read the clipboard: it is tab-separated rows with no row-number column and the values shown in the grid (including full competition names)

**Checkpoint**: The grid shows all rows and survives tab switching with its scroll position.

## Phase 5: User Story 3 - Sort, search and filter (P1)

**Goal**: Three-state sort, search across displayed text, competition, year and Used-for filters, always-visible count.
**Independent test**: Apply each control and check rows and "Showing X of Y innings".

- [x] T026 [P] [US3] Write Playwright tests in `web/tests/e2e/data-tab.spec.ts` (view part): clicking "Runs at 10 overs" three times goes ascending, descending, original (first row changes then returns); search narrows rows; competition and year filters combine; count always reads exactly "Showing X of Y innings"; row numbers restart at 1 after filtering; no-match shows the empty state and "Clear filters" restores all rows; sort and filters survive a tab switch
- [x] T027 [US3] Add the toolbar to `web/src/data-grid/data-grid.ts`: search box, a select for each column with `filter: "select"`, a year select for the `year` filter column, "Showing X of Y innings" (noun from the `noun` attribute), view state held in memory, header clicks driving the sort cycle, rows recomputed through `table-view.ts`
- [x] T028 [US3] Add the empty state with a "Clear filters" action in `web/src/data-grid/data-grid.ts` and make the grid show nothing but the message when no rows match
- [x] T029 [US3] Check responsiveness on all 5,146 rows (sort and filter well under 200 ms, smooth scroll); record the measurement in `specs/002-data-tab/research.md`

**Checkpoint**: Data is fully explorable.

## Phase 6: User Story 4 - See which innings are training and which are test (P2)

**Goal**: "Used for" matches the agent's split exactly and can be filtered.
**Independent test**: Counts match the agent's split.

- [x] T030 [P] [US4] Add pytest tests in `tests/test_data_api.py`: `used_for` is `test` exactly for the latest calendar year in `match_date` and `training` for earlier years, agreeing with `split_by_year`; training and test counts equal the split's counts
- [x] T031 [P] [US4] Add a Playwright test in `web/tests/e2e/data-tab.spec.ts`: filtering Used for to Test shows only rows from the latest year and the count equals the agent's test count from the run's split step
- [x] T032 [US4] Confirm the Used-for column shows Training/Test labels and its select filter works in `web/src/data-grid/data-grid.ts` (fix only if T031 fails)

**Checkpoint**: Split visibility verified end to end.

## Phase 7: User Story 5 - Understand where the data came from (P2)

**Goal**: Manifest summary above the grid, attribution on the tab, counts agree.
**Independent test**: Summary figures match the manifest and the agent's `load_data` step.

- [x] T033 [P] [US5] Add pytest tests in `tests/test_data_api.py`: summary total equals `len(rows)` and the `load_data` row count; per-competition counts sum to the total; exclusion rows match the manifest sums with zero counts omitted; `file_date` equals the manifest `download_date`
- [x] T034 [US5] Render the summary (headline figures, titled sections, attribution with link) above the toolbar and the attribution note at the foot of the Data tab in `web/src/data-grid/data-grid.ts`
- [x] T035 [P] [US5] Add a Playwright test in `web/tests/e2e/data-tab.spec.ts`: the summary total, the grid's "Y" and the agent's `load_data` step row count are equal; the attribution text is present

**Checkpoint**: Provenance visible and consistent.

## Phase 8: User Story 6 - Download the data as CSV (P2)

**Goal**: Complete or filtered CSV that opens correctly in spreadsheets.
**Independent test**: Download both variants and open them.

- [x] T036 [P] [US6] Write Playwright tests in `web/tests/e2e/data-tab.spec.ts` (download part): from Working, Data tab then Download CSV downloads a file in two clicks; the file name is `t20-first-innings-2026-10-01.csv` (from the manifest date) and the row count equals the table plus one header line; with a filter active a menu offers "All rows" and "Rows shown"; "Rows shown" contains only the filtered rows in the sorted order; "Rows shown" is disabled when nothing matches; the header matches the grid headings including "Used for"; the file starts with the byte-order mark
- [x] T037 [US6] Add the download control to `web/src/data-grid/data-grid.ts`: a "Download CSV" button that downloads all rows directly when no search, filter or sort is active, otherwise opens a two-item menu ("All rows", "Rows shown (N)", the second disabled at zero), generating the file with `csv.ts` and a `Blob` download; dismissing the menu downloads nothing; the attribution sits beside the button
- [x] T038 [US6] Make the menu keyboard accessible (button with `aria-haspopup`, arrow keys, Escape closes) in `web/src/data-grid/data-grid.ts`

**Checkpoint**: Downloads verified.

## Phase 9: User Story 7 - Recover from a data load failure (P3)

**Goal**: Clear message and retry on the Data tab; Working unaffected.
**Independent test**: Fail `/api/data`, check message and retry, then restore.

- [x] T039 [P] [US7] Add a Playwright test in `web/tests/e2e/data-tab.spec.ts`: abort `/api/data`, open Data, see the message and Retry; the Working tab and a run still work; unblock the route, press Retry, the grid appears
- [x] T040 [US7] Add `setLoading()`, `setError(message)` and the `retry` event to `web/src/data-grid/data-grid.ts`, and wire the loading, error and retry flow in `web/src/page/data-tab.ts` (a failed fetch is retried on request; a success is cached)

**Checkpoint**: All stories complete.

## Phase 10: Polish and cross-cutting

- [x] T041 [P] Add a Playwright reuse test in a new file `web/tests/e2e/reuse-data.spec.ts`, following the pattern of the existing `reuse.spec.ts`: add a fixture page `web/tests/fixtures/reuse-data.html` that loads only `<tab-set>` and `<data-grid>` (no app code) and a non-cricket table `web/tests/fixtures/other-table.json` (different columns, labels, a year-filter column and a select-filter column); assert tabs switch, the grid shows the rows, sort, search, filters and CSV download work, and nothing mentions cricket or regression
- [x] T042 [P] Verify light and dark appearance and keyboard use of the grid (focus visible, arrow-key cell movement, Ctrl+C copy) and fix gaps in `web/src/data-grid/styles.ts` and `web/src/data-grid/grid-adapter.ts`
- [x] T043 Run the whole suite: `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test`, `cd web && npm run build` (type-check); confirm no existing test or `data-testid` changed
- [ ] T044 (NOT DONE: needs a person with Excel or Google Sheets and a screen reader; the automated parts of the walkthrough pass) Walk through `specs/002-data-tab/quickstart.md` manually, including opening a downloaded file in Excel or Google Sheets, pasting copied cells, and a screen-reader pass (NVDA or VoiceOver) confirming the tabs are announced as tabs with their selected state and the grid headings are announced with their meanings
- [x] T045 Update `apps/linear_regression/README.md` with the Data tab, `/api/data` and the reusable modules

## Dependencies and order

- Phase 1 then Phase 2 (blocks everything). T003 (spike) gates T013.
- Within Phase 2: T004 first; T005 before T006 to T008; T009 to T012 are independent of the backend; T013 and T014 follow T003 and T004.
- US1 (tabs) needs only the Setup and Foundational phases and no data, so it can proceed alongside US2.
- US2 needs T006 to T008, T013, T014 and US1's panel (T017).
- US3 needs US2. US4, US5, US6 and US7 each need US2; US6 also needs US3 (active filter and sort menu).
- Polish last.

Order of delivery: US1, US2, US3 (the P1 set), then US4, US5, US6, then US7, then Polish.

## Parallel examples

- After T004: T005, T009, T010, T011, T012 together (different files).
- Once Phase 2 is done: T015 and T020 (tests for US1 and US2) together; T030, T033 and T036 (tests for later stories) together.
- Docs T019 and T025 can run alongside implementation.

## Implementation strategy

1. **MVP**: Phases 1 to 3 plus Phase 4: tabs and a viewable, scrollable, read-only grid. Stop and demo.
2. Add US3 for exploration, then US6 so the download works (the success criterion "two clicks to a CSV").
3. Add US4 and US5 for trust (split and provenance), then US7 for failure handling, then polish.
4. Run the full existing suite after every phase; nothing in `graph-replay`, the results card or try-your-own is touched.

## Task counts

| Phase | Tasks |
|---|---|
| Setup | 4 (T001, T001a, T002, T003) |
| Foundational | 11 (T004 to T014) |
| US1 Tabs | 5 (T015 to T019) |
| US2 Grid | 9 (T020 to T025, T046 to T048) |
| US3 Sort and filter | 4 (T026 to T029) |
| US4 Used for | 3 (T030 to T032) |
| US5 Summary | 3 (T033 to T035) |
| US6 Download | 3 (T036 to T038) |
| US7 Failure | 2 (T039 to T040) |
| Polish | 5 (T041 to T045) |
| **Total** | **49** |

Note: T001a and T046 to T048 were added after `/speckit-analyze` and keep their IDs so existing references stay valid; run them in their phase, not at the end. T047 follows T013 (adapter) and T021.
