# Implementation Plan: Intro Hero for the Working Tab

**Branch**: `013-intro-hero` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its two clarifications), the approved design in [design/README.md](design/README.md), and the planning brief.

## Summary

Replace the Working tab's introduction with the approved hero. The server does all the work with numbers and words: data preparation gains a second file, `data/overs.csv` (cumulative runs and wickets at the end of every over for every kept innings); `/api/reference` gains `average_total`, an `example` block for the innings chosen by `EXAMPLE_MATCH_ID`, and a `hero` block of sentences built by a new `hero_text` module (caption, panel sentence, footnote, chart text equivalent). The page shows those sentences as sent. A new `hero.ts` fills the panel and sentences; a new `worm.ts` draws the hand-built SVG worm chart from the example and the figures, with a pure label-spacing function. The breadcrumb moves above the tab bar. The old introduction (lead, miss meter, chips, two collapsible sections, catalogue `<details>`) and its modules and CSS are removed. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend, scripts); TypeScript, no framework (web)
**Primary Dependencies**: existing only (FastAPI, pandas, numpy; Vite, Vitest, Playwright). No new dependency
**Storage**: committed CSV files in `apps/linear_regression/data/` (`innings.csv`, `overs.csv` new, `manifest.json`)
**Testing**: pytest, Vitest, Playwright (as in earlier features)
**Target Platform**: Vercel (static plus the Python function); evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the uv-workspace monorepo (`apps/linear_regression`)
**Performance Goals**: `/api/reference` stays computed once per process and cached as today; reading `overs.csv` (about 100,000 rows) is filtered to one match, so it adds no noticeable time
**Constraints**: every number and every data-dependent sentence comes from the server; no animation; the top of the model picker is visible at 1280 × 800; no sideways scroll at 360 px; everything outside the Working tab's introduction is unchanged
**Scale/Scope**: 1 new data file, 1 extended endpoint, 1 new backend module, 2 new page modules, 1 new CSS token

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | Sentences and figures are built once on the server; the page shows them as sent; bias wording reuses `accuracy_text` |
| No numbers typed into the page | Typed copy is the README's fixed wording only; a Playwright test compares every number on screen with `/api/reference` |
| The test and check years stay unseen | The example must come from the same years as the introduction's figures (before the first check year); otherwise `example: null` |
| A failure never shows invented numbers | Failed request or null figures: plain "could not be loaded" state; null example: chart card left out |
| No new dependencies | none |

**Re-check after design**: no violations. One departure under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-intro-hero/
├── plan.md
├── research.md
├── data-model.md          # overs.csv, the example block, the hero block, thresholds
├── quickstart.md          # regenerate data, run the three test suites, look at the page
├── contracts/reference-api.md   # the extended /api/reference response; DOM and test ids
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
scripts/prepare_data.py     # CHANGED: per-over totals in the existing ball pass; overs.csv written with the temp-then-replace pattern;
                            #          manifest records it and its row count; --from-existing fails with its existing message
data/overs.csv              # NEW (regenerated with innings.csv and manifest.json from a fresh download)
data/innings.csv, manifest.json   # REGENERATED (figures move slightly)
backend/linreg/
├── settings.py             # CHANGED: EXAMPLE_MATCH_ID = 1223954 (the module is otherwise env-reading helpers; see research.md)
├── overs_loading.py        # NEW: load_overs(path) with validation; example_innings(innings_df, overs_df, match_id, allowed_rows) -> dict | None
├── hero_text.py            # NEW: BARELY_HELPS_SHARE = 0.10, TYPICAL_MISS_SHARE = 0.25; caption, panel sentence, footnote, chart text
├── reference_api.py        # CHANGED: average_total, example, hero blocks; example None on any fault (warning logged)
├── accuracy_text.py        # unchanged (bias_words / bias rules are reused by hero_text)
tests/                      # NEW: test_overs_data.py, test_example_innings.py, test_hero_text.py; CHANGED: test_prepare_data.py, test_reference_api.py
web/index.html              # CHANGED: breadcrumb above <tab-set>; hero markup replaces the intro section; old intro, chips, details, catalogue <details> and CSS removed; --tv token
web/src/page/
├── hero.ts                 # NEW: fetches /api/reference once; fills panel, sentences, footnote; failed/null states; mounts worm
├── worm.ts                 # NEW: SVG chart from example + figures; scale, markers, lines, miss bar, key fallback
├── worm-layout.ts          # NEW: pure functions: yScale (0..200, steps of 50), spreadLabels(values, min gap, height)
├── reference-types.ts      # NEW: the Reference, Figures, MethodDef types moved out of reference.ts (accuracy.ts and accuracy-chart.ts import them)
├── reference.ts, meter.ts  # REMOVED
├── catalogue.ts            # CHANGED: setupCatalogue's display removed; loadCatalogue kept (results use the feature names)
└── main.ts                 # CHANGED: setupHero replaces setupReference; setupCatalogue call removed
web/tests/
├── unit/                   # NEW: worm-layout.test.ts, worm.test.ts; REMOVED: meter.test.ts, meter-colours.test.ts; setup.test.ts / catalogue tests adjusted
└── e2e/                    # NEW: hero.spec.ts; CHANGED: reference.spec.ts (rewritten), the feature 008 population-sentence test, and any e2e that touched the removed intro
```

**Structure Decision**: keep the app's layout. Numbers and words live in pure backend modules (`overs_loading`, `hero_text`) so every rule is unit-tested without a browser; the web has one drawing module and one pure layout module.

## Design

### Per-over data (`prepare_data.py`)
`rollup_match` already walks every delivery, but skips everything after over 10 for the candidate features. Add running `cum_runs` and `cum_wickets` totals that count every delivery (wickets by the same `NOT_A_DISMISSAL` rule) and are appended to a per-innings list at the end of each over. `rollup_match` and `process_zip` gain an optional `overs_out` list parameter (default `None`), so their existing return values and callers do not change. An innings with fewer than 20 overs bowled has fewer rows. `write_outputs` gains `overs_rows` and writes `overs.csv` via `overs.csv.tmp`, replacing all three files only after all are ready. The manifest gets `overs: {"file": "overs.csv", "rows": N}`. `run_from_existing` is unchanged: it does not produce overs.csv and keeps its message for missing ball-by-ball columns; the existing check cannot see the new file, so it is extended: if `overs.csv` is absent when `--from-existing` is run it also stops with the same kind of message. Rows are ordered by the innings' order in `innings.csv`, then over. Not shown on the Data tab, not in the CSV download.

### The example (`overs_loading.py`, `reference_api.py`)
`build_reference` already holds `train` (test-population innings before the first check year). The example row is looked up in **`train`** by `EXAMPLE_MATCH_ID` (compared as text, since the CSV id can be read as a number), so a check-year or test-year or out-of-population innings is excluded by construction. Then its 20 overs are read from `overs.csv`. Any fault (id not in `train`, id missing from `overs.csv`, fewer or more than 20 overs, over-10 or over-20 values disagreeing with `runs_at_10`/`final_total`) logs a warning and gives `example: null`; the rest of the response is unchanged. `average_total` is the mean of `train["final_total"]` that the know-nothing guess already uses, rounded once to whole runs on the server. The example block carries the TV projection (`runs_at_10 × 2`), its miss in runs for this innings, and `wicket_overs`.

### Sentences (`hero_text.py`)
Two named constants, `BARELY_HELPS_SHARE = 0.10` and `TYPICAL_MISS_SHARE = 0.25`. Pure functions take the response's own figures and the goal's margin and return the caption, panel sentence, footnote and chart text equivalent. Rules: "barely helps" iff `0 < (know_nothing_miss − tv_miss) / know_nothing_miss ≤ 0.10`; a gap of zero or less takes a plain wording that the TV is no better than knowing nothing (never "barely helps"); a larger gap states the improvement plainly; "about its typical miss" iff `|this_miss − tv_miss| ≤ 0.25 × tv_miss`; direction from `accuracy_text` bias rules ("too low", "too high", or no direction claim when the bias rounds to 0.0). The goal margin comes from `goal()["margin_runs"]`. The footnote states the test population ("<N> past innings, <first> to <last>: IPL, BBL and full-member internationals"), taking its population wording from one constant shared with the existing population sentence. The caption month and year come from the example's date, formatted on the server. If `example` is null, the caption and chart text are null.

### Page
`index.html`: the breadcrumb (`Part of` wording replaced by the README's "Explain Machine Learning in Cricket Terms" link from `%VITE_SITE_URL%` › "Linear regression") sits in a `<nav aria-label="Breadcrumb">` above `<tab-set>`. The Working panel's intro section becomes the hero: eyebrow, `h1`, lead, a two-column grid (chart `<figure>` with `<figcaption>`; panel then steps), then the unchanged model picker and its note. `hero.ts` fetches `/api/reference` once and renders; `worm.ts` receives the response and draws an `<svg role="img" aria-label=…>` using the server's text equivalent. `worm-layout.ts` holds the y scale (0–200, extended in steps of 50 to fit any plotted value including TV projection + average miss) and `spreadLabels` (sort by value, push apart to a minimum gap within the plot height, clamp). Below a width breakpoint, end labels move out of the SVG into a small key under the chart. Wicket circles are skipped at overs 10 and 20. `--tv` is added to the `:root` and dark blocks.

### Removed
`reference.ts` and `meter.ts` (with their unit tests), the chips, `.intro-*`, `.meter*`, `.reference-*`, `.chip*`, `details.intro-more` and catalogue CSS, the catalogue `<details>`, and `setupCatalogue`'s display code. The `meter`, `sentences`, `gap`, `words` and `goal.lead` fields of `/api/reference` are **kept** in the response (they are used by backend tests and the final results' accuracy views, and removing them is outside this feature).

### Fold check
At 1280 × 800 the hero (breadcrumb, tab bar, header, chart card) plus the model picker's top must fit in 800 px. The heading at 44 px and a chart about 300 px tall leave little room; the chart height, header spacing and lead width are tuned against this requirement and verified by a Playwright test (see research.md).

## Complexity Tracking

| Departure | Why | Simpler alternative rejected |
|---|---|---|
| `EXAMPLE_MATCH_ID` in `settings.py`, which today holds only environment-reading helpers | The brief fixes this location | A new `hero_settings.py`: more files for one constant |
| `/api/reference` keeps now-unused page fields (`meter`, `goal.lead`) | Other backend tests and views depend on them | Removing them: wider change than this feature |
| Two optional parameters added to `rollup_match` and `process_zip` | Keeps the one-pass requirement and existing callers intact | Returning a larger tuple: breaks every existing caller and test |
