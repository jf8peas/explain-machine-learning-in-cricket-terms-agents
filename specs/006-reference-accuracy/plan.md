# Implementation Plan: How Good Is the Reference? Accuracy Against Real Totals

**Branch**: `006-reference-accuracy` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification (with its Clarification: keep the 3-run goal and report the percentage beside it) plus the technical decisions supplied with `/speckit-plan`. Every decision in the brief is followed; where it left a choice open (rounding, the thresholds, the colours and names, how the intro fits in the first screen, what the goal does when the server is down) the choice and its reason are in [research.md](research.md).

## Summary

A third reference, the know-nothing guess (the training years' average total), joins the broadcaster's projection and the agent's models. A new generic accuracy function describes any prediction against actual totals in four ways: average miss, hit rate within 10 and 20 runs, miss as a share of a typical total, and bias. A new endpoint, `GET /api/reference`, gives the introduction the training-years figures for the two references, so a visitor sees how good the bar is before running anything. At the end of a run, `final_test` scores all four methods once on the test year; the results show them side by side in a table, with a hand-built predicted-versus-actual chart under it and a verdict that reports the improvement in runs and as a percentage. The goal and the method names each live in one backend place and everything reads from there. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web)
**Primary Dependencies**: Existing only: FastAPI, pandas, numpy, LangGraph, Vitest, Playwright. No new dependency, no chart library
**Storage**: None new. Reads the committed `data/innings.csv`
**Testing**: pytest, Vitest, Playwright (fake model and in-memory store, as in 004 and 005); no test reaches the network
**Target Platform**: Vercel (static plus the Python function); evergreen browsers; phone widths
**Project Type**: Web app inside the uv-workspace monorepo (as 001 to 005)
**Performance Goals**: `/api/reference` is computed once per process and cached; `final_test` adds four cheap calculations on about 500 innings
**Constraints**: The test year is read only inside `final_test`; the introduction's figures use training years only; every figure comes from code and is rounded in one place; the Play button stays visible in a 1280 × 800 window (it is at 626 to 661 px today, so about 130 px of height is free); all existing test ids and tests keep working
**Scale/Scope**: 4 methods, 5 measures, about 515 test innings, up to 2,060 chart marks

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief: one definition of the methods, the goal and the large-bias rule; every number from code; training years for the introduction and the test year used once.

**Re-check after design**: no violations. Departures from, or additions to, the brief are listed under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-reference-accuracy/
├── plan.md
├── research.md          # 15 decisions, with the real training-year numbers the design rests on
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── accuracy.py          # NEW, generic: accuracy(), display(), TOLERANCES, LARGE_BIAS_SHARE, is_large_bias(), same_direction_large_bias()
├── evaluation.py        # CHANGED, generic: know_nothing_guess() beside broadcaster_projection()
├── methods.py           # NEW: the four methods (id, name, note, marker), defined once
├── goal.py              # NEW: the goal and verdict() built from MARGIN_RUNS; CLEARLY_BETTER_SHARE and the reference finding
├── accuracy_text.py     # NEW: cricket wording for figures (bias in words, hit rate, gap, findings)
├── reference_api.py     # NEW: GET /api/reference (training years only)
├── nodes.py             # CHANGED: baseline scores the know-nothing guess; final_test adds accuracy, identical, bias_finding, verdict, chart_points
├── cricket_explanation.py # CHANGED: sentences against the know-nothing guess and the projection, hit rate, bias; goal wording from goal.py
api/index.py             # CHANGED: mount the reference router
vercel.json              # CHANGED: cache header for /api/reference
tests/
├── test_accuracy.py             # NEW
├── test_reference_api.py        # NEW
├── test_reference_in_run.py     # NEW: baseline and final_test additions
├── test_explanation_numbers.py  # CHANGED: new figures and sentences
├── test_boundaries.py           # CHANGED: accuracy.py shared; methods, goal, accuracy_text, reference_api app-specific
web/src/graph-replay/
├── state-view.ts        # NEW, generic: summarise long arrays in the state panel
├── graph-replay.ts      # CHANGED: the state panel uses state-view.ts
web/src/page/
├── reference.ts         # NEW: fetches /api/reference, renders the introduction's block and the goal
├── accuracy.ts          # NEW: the results table, the findings, the expectation note, and the toggles that drive the chart
├── accuracy-chart.ts    # NEW: pure helpers (axis range, ticks, markers, default selection) and the SVG chart
├── results.ts           # CHANGED: calls accuracy.ts under the existing comparison; verdict from the goal object
└── main.ts              # CHANGED: starts reference.ts
web/index.html           # CHANGED: the hand-written goal paragraph and the "benchmark" sentence replaced by the reference block; chart and table styles
web/tests/
├── unit/accuracy-chart.test.ts, unit/state-view.test.ts   # NEW
├── e2e/reference.spec.ts                                   # NEW
└── e2e/structure.spec.ts, llm-run.spec.ts, explanation.spec.ts  # CHANGED only where the page text moved
```

## Design Notes

Decisions are in `research.md`; the points that matter when building:

- **One accuracy function** returns unrounded figures; one `display()` rounds to one decimal. State, endpoint, explanation and page all use the rounded figures, so a reader can reproduce any derived number.
- **The goal and the methods are objects**, not strings in several files: `goal.py` and `methods.py`. `index.html` loses its hand-written goal.
- **The verdict is computed from displayed figures**: improvement in runs, then the percentage of the projection's displayed miss, then "reached". A reader can check it by hand.
- **`/api/reference` slices training only** and is computed once per process. If the data cannot be read it still sends the goal, with a message.
- **`baseline` and `final_test`** keep their jobs: `baseline` never reads the test year; `final_test` is still the only reader of the test slice and scores each method exactly once.
- **The final state is self-describing**: it carries the definitions of the methods it scored (`final.method_defs`) and the reference finding for the test year, so the results never wait on the introduction's request.
- **Chart points travel in a separate top-level key** so the state panel can summarise them generically.
- **The chart** is hand-built SVG with stable axes, open marker shapes, real toggle buttons and a table above it as the text alternative.
- **The introduction block replaces text** instead of adding to it, to keep Play in the first screen.

## Testing Strategy

- **pytest**
  - `accuracy()` against hand-worked examples: exactly 10 runs off counts as within 10 (inclusive), zero bias, the large-bias rule at, just below and just above the threshold, an empty input and a single innings, and unrounded inputs;
  - the know-nothing guess is the mean of the training rows given to it, and changing validation or test rows changes it not at all;
  - `/api/reference` equals an independent calculation on the training years, and changing every test-year (and validation-year) value in a copy of the data changes nothing in its response (SC-004); the failure case still returns the goal;
  - `final_test` scores each of the four methods once, and is still the only reader of the test slice (the existing spy test, extended);
  - every figure in the results state and the explanation equals the final state (extending `test_explanation_numbers.py`);
  - the goal wording and numbers are identical in the endpoint, the verdict and the explanation, and the percentage equals the improvement divided by the projection's displayed miss;
  - the language-model fallback gives three methods; identical predictions are both kept and flagged; the same-direction large-bias finding fires on made-up numbers and not otherwise;
  - boundaries: `accuracy.py` and `evaluation.py` import nothing app-specific.
- **Vitest**
  - chart: the axis range covers every point of every method and is the same on both axes; ticks are round numbers inside the range; each method gets its own marker; the default selection is the winner plus the TV projection; the empty selection state; a missing language-model method is not offered;
  - state view: arrays longer than 20 become "N items" at any depth, short arrays and everything else are unchanged.
- **Playwright**
  - before any run the introduction shows both reference rows, the goal, and Play is visible in a 1280 × 800 window;
  - after a run the results show four rows (three with the fallback model) and the table's figures match the state;
  - chart toggles add and remove marks; selecting none shows the prompt; identical predictions show two marks; the chart is square, in light and dark, and at phone width without horizontal page scroll; each method's marker differs;
  - the state panel shows "N items" instead of the points;
  - the verdict reads "… runs better, …%" with the goal's words, and the expectation note is present near the results.
- **Existing** unit and e2e tests keep passing (`comparison`, `final-llm`, `final-forward`, `final-tv`, `winner`, `verdict` and `goal` test ids stay).
- **Manual**: SC-001 and SC-002 (a person judges whether they can say how good the bar is, and how the winner compares), listed in `quickstart.md`.

## Risks

- **The introduction's height**: the new block is about as tall as the free space. The first implementation task measures Play at 1280 × 800 and trims text if needed; the Playwright test is the arbiter.
- **Rounding edges in the verdict**: an unrounded improvement of 2.96 displays as 3.0 and counts as reached. Accepted so that the verdict can be checked from the page; documented in research.md.
- **Existing tests that assert the verdict's wording or the old goal text**: handled by keeping the key phrases ("beat the TV projection", "at least 3 runs") in the new wording.
- **Marker legibility**: open shapes at four sizes on a dense cloud of 2,000 marks. The Vitest and Playwright checks cover that marks exist and differ; legibility is a manual look in light, dark, greyscale and phone width.
- **The goal when the server is unreachable**: the page cannot show it, because it exists only in the backend. See Complexity Tracking.

## Complexity Tracking

Additions or departures, each with its reason:

| Departure or addition | Reason |
|---|---|
| The introduction block replaces the goal paragraph and one sentence | The free height above Play is about 130 px; adding the block on top of the current text would push Play off the first screen |
| The display name of the projection is "the TV projection" | The page, the tests and the verdict already use that phrase; "broadcaster's projection" stays in the technical note |
| `chart_points` is a top-level state key, with `actual` stored once | Keeps `final` small, lets the state panel summarise one key, and avoids sending the actual totals four times |
| The chart's axes are computed from all methods, not the selected ones | The chart does not rescale when a method is toggled, and its range always covers every shown point |
| `final.beat_tv`, `cleared_margin` and `improvement` are kept, now derived from `final.verdict` | Existing tests and consumers keep working, and there is one truth |
| The goal text reaches the page only through `/api/reference` | The brief removes the hand-written text; if the server is unreachable the page shows only a "could not be loaded" note |
| The state panel says "N items", not "N points" | The panel is generic and cannot know what the items are |
| The large-bias finding leaves out the know-nothing guess | Its bias is near zero by construction, so including it would stop the finding from ever applying |
| `final` carries `method_defs` and `reference_finding` | The results can name every method and say how the projection compared with the floor on the test year without a second request |
