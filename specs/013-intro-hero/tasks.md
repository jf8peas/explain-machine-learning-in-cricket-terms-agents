# Tasks: Intro Hero for the Working Tab

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/reference-api.md](contracts/reference-api.md), [design/README.md](design/README.md) (authoritative for copy and layout)
**Tests**: requested by the plan; included per story.
**Paths**: `APP` = `apps/linear_regression`. Run Python tests with `uv run pytest APP/tests`, web unit tests with `npm test` and e2e with `npx playwright test` in `APP/web`.

Story order follows dependency, not only priority: US3 (server data) feeds US2 (sentences), which feed US1 (the page); US4 (removals) comes last because it needs the hero in place.

## Phase 1: Setup

- [X] T001 Add `EXAMPLE_MATCH_ID = 1223954` (with a one-line comment: the innings drawn in the Working tab hero) to `APP/backend/linreg/settings.py`
- [X] T002 [P] Move the `Figures`, `MethodDef`, `Mark`, `Reference` types out of `APP/web/src/page/reference.ts` into new `APP/web/src/page/reference-types.ts` (extend `Reference` with `average_total`, `example`, `hero` per [contracts/reference-api.md](contracts/reference-api.md)); re-point the imports in `APP/web/src/page/accuracy.ts` and `APP/web/src/page/accuracy-chart.ts`; run `npm test` to confirm nothing changed

## Phase 2: Foundational (per-over data)

**Blocks every story.**

- [X] T003 Write failing tests in `APP/tests/test_prepare_data.py`: `rollup_match(..., overs_out=[])` appends one dict per over bowled with cumulative runs and wickets (dismissals use the `NOT_A_DISMISSAL` rule); the over-10 values equal `runs_at_10` / `wickets_at_10` and the over-20 runs equal `final_total`; excluded matches append nothing; existing return values are unchanged
- [X] T004 Implement per-over totals in `APP/scripts/prepare_data.py`: running cumulative runs and wickets counted for every delivery (before the `idx > LAST_OVER` skip), appended at the end of each over; add the optional `overs_out` parameter to `rollup_match` and `process_zip` (default `None`)
- [X] T005 Write failing tests in `APP/tests/test_prepare_data.py` for the files: `write_outputs` writes `overs.csv` via `overs.csv.tmp` and replaces all three files only after all are ready (and leaves no `.tmp` on failure); the manifest records `overs: {file, rows}`; `--from-existing` stops with its clear message when `overs.csv` is absent and never writes one
- [X] T006 Implement T005 in `APP/scripts/prepare_data.py` (`run_download` collects the rows in the same pass, in `innings.csv` order then over; `write_outputs` gains `overs_rows`; `run_from_existing` checks for `overs.csv`)
- [X] T007 Regenerate the committed data from a fresh download: `uv run python APP/scripts/prepare_data.py`; confirm `APP/data/overs.csv` exists, the manifest records it, and `innings.csv` moved only slightly; run the whole pytest suite and list any test that hard-codes a figure that moved
- [X] T008 Update only the tests T007 found, in `APP/tests/` (figures that moved), and note each in `research.md` under "Open items"
- [X] T009 [P] New test `APP/tests/test_overs_data.py`: for every innings in the committed `innings.csv`, the rows in `overs.csv` have non-decreasing cumulative values, over-10 values equal `runs_at_10` / `wickets_at_10`, over-20 runs equal `final_total`, and every `match_id` is in `innings.csv`
- [X] T010 Create `APP/backend/linreg/overs_loading.py`: `load_overs(path=None)` (validates columns, raises `DataError` like `data_loading.py`); add a test in `APP/tests/test_overs_data.py` that the `/api/data` response and the CSV download have no over-level rows or columns, so `overs.csv` stays off the Data tab

**Checkpoint**: `overs.csv` is committed and verified.

## Phase 3: User Story 3 - Numbers come from the server, checked automatically (P1)

**Goal**: `/api/reference` carries `average_total` and the example innings; faults give `example: null`.
**Independent test**: `uv run pytest APP/tests/test_example_innings.py APP/tests/test_reference_api.py`

- [X] T011 [P] [US3] Failing tests in new `APP/tests/test_example_innings.py`: the example block matches `innings.csv` and `overs.csv` for the configured id (teams, venue, date, 20 cumulative runs and wickets, `runs_at_10`, `wickets_at_10`, `final_total`, `tv_projection` = `runs_at_10 × 2`, `tv_miss`, `wicket_overs` listing each over with a wicket once); changing `EXAMPLE_MATCH_ID` changes the innings
- [X] T012 [P] [US3] Failing tests in new `APP/tests/test_example_innings.py` for faults, each giving `example: null` with a logged warning and the rest of the response intact: id missing from `innings.csv`, id missing from `overs.csv`, id in a check year or the test year, id outside the test population, an innings with fewer than 20 overs, over-10 or over-20 values disagreeing with `innings.csv`
- [X] T013 [US3] Add to `APP/tests/test_reference_api.py`: `average_total` equals the know-nothing mean of the training rows (whole runs) and the existing fields are unchanged
- [X] T014 [US3] Implement `example_innings(train, overs, match_id)` in `APP/backend/linreg/overs_loading.py` (look the id up in `train`, compared as text; return `None` for every fault)
- [X] T015 [US3] Extend `build_reference` and `_unavailable` in `APP/backend/linreg/reference_api.py`: `average_total`, `example` (log a warning when `None`; read `overs.csv` next to the innings file), `hero` placeholder `None` until US2; `create_router` accepts the overs path for tests

**Checkpoint**: the endpoint carries verified example data.

## Phase 4: User Story 2 - Every sentence stays true to the figures (P1)

**Goal**: caption, panel sentence, footnote and chart text are built on the server.
**Independent test**: `uv run pytest APP/tests/test_hero_text.py`

- [X] T016 [US2] Failing tests in new `APP/tests/test_hero_text.py`, against at least three sets of figures: TV barely better (0 < gap ≤ 10%), TV clearly better, TV equal to knowing nothing, TV worse than knowing nothing (these last two never say "barely helps"); bias below, above, and rounding to 0.0 ("too low", "too high", no direction claim); this innings' miss inside and outside 25% of the TV's average miss (the clause appears only when true); the goal margin follows `goal()["margin_runs"]`; the footnote states the population and its numbers; the caption and chart text are `None` when the example is `None`; boundary values at exactly 10% and 25%
- [X] T017 [US2] Create `APP/backend/linreg/hero_text.py` with `BARELY_HELPS_SHARE = 0.10` and `TYPICAL_MISS_SHARE = 0.25` and pure functions `caption`, `panel_sentence`, `footnote`, `chart_text` using the README's wording from [design/README.md](design/README.md) and `accuracy_text.bias_words` / the existing bias rules (add a small helper in `accuracy_text.py` only if direction wording cannot be reused)
- [X] T018 [US2] Wire `hero` into `build_reference` in `APP/backend/linreg/reference_api.py` (null when figures are unavailable); add a test to `APP/tests/test_reference_api.py` that every number in `hero` text equals a figure in the same response

**Checkpoint**: the whole API contract is in place.

## Phase 5: User Story 1 - Understand the app at a glance (P1)

**Goal**: the hero on screen, from server data only.
**Independent test**: `npx playwright test hero.spec.ts` and the Vitest tests below, in `APP/web`.

- [X] T019 [P] [US1] Failing Vitest tests in new `APP/web/tests/unit/worm-layout.test.ts`: `yScale` is 0 to 200 in steps of 50 and extends (to 250, 300, ...) when any value, including TV projection + average miss, is higher; `spreadLabels` keeps a minimum gap and stays in range for widely spread, equal and three nearly equal values, and returns labels in the right order
- [X] T020 [US1] Create `APP/web/src/page/worm-layout.ts` (pure `yScale`, `spreadLabels`)
- [X] T021 [P] [US1] Failing Vitest tests in new `APP/web/tests/unit/worm.test.ts`: wicket circles omitted at overs 10 and 20; the 10-over dot label reads "<runs>/<wickets>"; end labels in the chart carry "Actual", "TV projection", "Know-nothing", "The agent: ?"; at narrow width the end labels move to the `worm-key` element and not into the SVG; the SVG `aria-label` equals `hero.chart_text`
- [X] T022 [US1] Create `APP/web/src/page/worm.ts` drawing the hand-built SVG as the README describes (axes, future region, 10-over line, thick and thin lines, diamond, wicket circles, dashed TV line, dotted know-nothing line, ± average-miss bar, end labels via `spreadLabels`); text set with `textContent`, no animation
- [X] T023 [US1] Create `APP/web/src/page/hero.ts`: `setupHero(root)` fetches `/api/reference` once, fills `tv-miss`, `nothing-miss`, `tv-sentence`, `tv-footnote`, `worm-caption`, mounts `worm.ts`; request failure or null figures shows `hero-unavailable` with no numbers; null `example` leaves the chart card out
- [X] T024 [US1] Edit `APP/web/index.html`: add `--tv` to `:root` (`#a85600`) and the dark block (`#e8913a`) per research decision 6; move the breadcrumb (site link from `%VITE_SITE_URL%` then "Linear regression") into a `<nav data-testid="breadcrumb" aria-label="Breadcrumb">` just above `<tab-set>`; replace the intro section's contents with the hero markup (eyebrow, `h1`, lead, chart `<figure>` with `<figcaption>`, panel, three steps, using only the README's fixed wording with no numbers); add the hero CSS (two columns wrapping to one at narrow widths, chart first, light and dark tokens only, system font stack, no animation); keep the model picker and its "runs can differ" note directly under the hero
- [X] T025 [US1] Update `APP/web/src/page/main.ts` to call `setupHero` in place of `setupReference`
- [X] T026 [P] [US1] Vitest colour test (follow `APP/web/tests/unit/chart-colours.test.ts`): `--tv` has at least 4.5:1 contrast on `--bg` and `--surface` in light and dark
- [X] T027 [US1] New `APP/web/tests/e2e/hero.spec.ts`: element order with the breadcrumb above the tab bar and the chart before the panel and steps in one column; the top of the model picker is within the viewport at 1280 × 800; no horizontal scroll at 360 px (`scrollWidth <= clientWidth`); light and dark render; no Play or Data-tab buttons or links in the hero; the breadcrumb's first link has a non-empty `href` equal to the configured site URL and the second item reads "Linear regression"; the chart's `aria-label` is non-empty and equals the response's `hero.chart_text`; end labels do not overlap (bounding boxes)
- [X] T028 [US1] Tune chart height, header spacing and headline size in `APP/web/index.html` until T027's fold test passes (headline size drops before the picker's position changes)
- [X] T029 [US4] Remove from `APP/web/index.html` the old lead and miss-meter markup, the chips, "How this works, in full", "Full figures for the two simple guesses", the catalogue `<details>`, and the CSS for `.intro-lead`, `.meter*`, `.reference-*`, `.chip*`, `details.intro-more`, `.intro-full-body`, `.intro-population` and the catalogue display
- [X] T030 [US4] Delete `APP/web/src/page/reference.ts`, `APP/web/src/page/meter.ts`, `APP/web/tests/unit/meter.test.ts`, `APP/web/tests/unit/meter-colours.test.ts`; in `APP/web/src/page/catalogue.ts` remove `setupCatalogue`'s display (keep `loadCatalogue`) and its call in `main.ts`; fix `APP/web/tests/unit/setup.test.ts` and any import that breaks
- [X] T031 [US4] Rewrite `APP/web/tests/e2e/reference.spec.ts` for the hero (figures, sentences and footnote equal the server's; no old introduction content); point feature 008's population-sentence test at `tv-footnote`
- [X] T032 [US4] Run `rg "intro-lead|reference-row|reference-details|meter-|chips|intro-full|catalogue" APP/web/tests` and edit only the e2e tests that checked the removed introduction (expected: `llm-run.spec.ts`, `stages.spec.ts`, `structure.spec.ts`, `catalogue.spec.ts`)

**Checkpoint**: the hero works end to end.

## Phase 6: User Story 3 (page side) and failure states

- [X] T033 [US3] In `APP/web/tests/e2e/hero.spec.ts`: every number in the hero's text and SVG labels equals the `/api/reference` response (miss figures, bias, average total, innings count, years, margin, runs, wickets, final total, TV projection); the only numbers allowed from elsewhere are a fixed allow-list: the axis ticks (0, 50, 100, 150, 200 and the extension steps; 0, 5, 10, 15, 20 overs) and the steps' numerals 1 to 3; and a test that routes `/api/reference` with altered `example` runs and figures shows the changed numbers in the chart, labels and text
- [X] T034 [US3] In `APP/web/tests/e2e/hero.spec.ts`: a failed `/api/reference` request and `figures: null` show `hero-unavailable` with no numbers; `example: null` leaves the chart card out and shows no numbers for it while the panel still shows

## Phase 7: User Story 4 - Old introduction gone, everything else unchanged (P2)

The removals and test fixes (T029–T032, labelled [US4]) sit at the end of Phase 5 so the e2e suite is not left red; this phase holds the story's final check.

- [X] T035 [US4] New e2e test in `APP/web/tests/e2e/hero.spec.ts`: none of the removed elements or their text remain on the Working tab; the model picker, its note, the graph, the summary line and the other tabs still render as before (existing specs for them pass unchanged)

## Phase 8: Polish

- [X] T036 [P] Run `uv run pytest APP/tests`, `npm test` and `npx playwright test`; fix only regressions this feature caused
- [X] T037 [P] Update `APP/README.md` for `overs.csv` (what it holds, that it needs a fresh download) and the Working tab's hero
- [ ] T038 (NOT DONE: needs a person to judge SC-001; screenshots in light, dark and 360 px were checked by the implementer) Walk through [quickstart.md](quickstart.md) in light and dark mode at 1280 × 800 and 360 px; have a person judge success criterion SC-001 (a few seconds, no scrolling) and record the answer in `specs/013-intro-hero/checklists/requirements.md` notes
- [ ] T039 (PARTLY: `vercel.json` excludes web/tests/scripts only, so data/overs.csv ships; the first deployed request still has to be checked) Check `vercel.json` `excludeFiles` does not exclude `data/overs.csv` from the function bundle, and that the first request after deploy returns a non-null `example`

## Dependencies

- Phase 1 → Phase 2 → US3 (Phase 3) → US2 (Phase 4) → US1 (Phase 5, ending with the removals and test fixes T029–T032 so the e2e suite is green again) → Phase 6 → US4 check (Phase 7) → Polish.
- T002 is independent of the backend; T019–T022 and T026 can start once `reference-types.ts` exists (T002), even before the API is done, using fixtures.
- T027/T028 need T024; T033/T034 need T023; T029–T035 need the hero working (T024–T025).

## Parallel examples

- After T001: T002 (web types) alongside T003–T006 (data preparation).
- Phase 3: T011 and T012 together (same new file, different tests; edit sequentially if one agent).
- Phase 5: T019, T021, T026 together; then T020, T022.

## Implementation strategy

MVP is Phases 1–5: the data, the endpoint, the sentences and the hero on screen. Phase 6 hardens failure states, Phase 7 removes the old introduction and cleans the tests, and Phase 8 verifies the whole. Commit after each phase; do not regenerate the data (T007) twice.
