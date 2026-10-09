# Implementation Plan: A Realistic Setup and a Steadier Judge

**Branch**: `008-realistic-setup-rolling-validation` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its five clarifications) and the planning brief. Every value the brief left open is chosen in [research.md](research.md) from the real data and from measurements.

## Summary

The agent is judged on a fixed test population (IPL, BBL and T20 internationals between ICC full members) using three rolling validation checks instead of one validation year, and a proposal grows from a feature list to a full setup (features, training window, recency weighting, training innings). The language model chooses from bounded menus that code checks; the mechanical rival becomes a visible grid search over the same menus (24 combinations, forward selection inside each). Fitting stays exact but becomes fast: for each check and each (window, training innings) subset the weighted Gram matrices are built once, and fitting any feature subset is a small linear solve, which is what lets the grid stay complete inside the run limit (about 0.5 s, estimated from measured parts, against about 38 s for the naive loop). The winner is decided on validation error before `final_test` reads the test year; both best setups are then refitted on all years before the test year and scored once. The data preparation records team names and membership; the new columns flow to the Data tab, the CSV and the feature catalogue. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web), no framework
**Primary Dependencies**: Existing only (numpy, pandas, pydantic, LangGraph). No new dependency
**Storage**: None at runtime. `data/innings.csv` and `data/manifest.json` are regenerated offline by `scripts/prepare_data.py`
**Testing**: pytest, Vitest, Playwright (fake model and in-memory store); no test reaches the network except the one-off live-model check in `quickstart.md`
**Target Platform**: Vercel (static plus the Python function); evergreen browsers
**Project Type**: Web app inside the uv-workspace monorepo (as 001 to 007)
**Performance Goals**: the complete 24-combination grid search in at most 3.0 s on the committed data (expected about 0.5 s); the whole run inside feature 004's 80 s deadline with its 8 s reserve
**Constraints**: the test year is read only inside `final_test`; no check reads its own or a later year; the language model cannot change how it is judged; every menu id, label, member name, half-life and minimum lives in one module; no number or menu label typed in the page
**Scale/Scope**: 3 checks; 4 windows × 3 weightings × 2 training-innings choices = 24 combinations; 18 candidate features (16 today plus 2); about 5,150 innings (test population about 2,870)

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief and the earlier features:

| Principle | How the plan meets it |
|---|---|
| The model chooses what to try, never what is solved or how it is judged | Population, checks, minimums, menus and weights are code constants in one module; proposals are checked against them |
| The test year is read once | `rolling_checks` gives the test slice only to `final_test`; a test replaces every test-year value and shows nothing earlier changes |
| Every number comes from code | Check errors, grid cells and the winner are computed in code; the page types no figure or menu label |
| One source for each fact | `setup_settings.py` for the menus, members and half-lives; `rolling_checks` for the years; `redundancy.redundant_columns` for repeats |
| No new dependencies | numpy `solve` and `eigvalsh` on small blocks; no scikit-learn or scipy |

**Re-check after design**: no violations. Departures are under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-realistic-setup-rolling-validation/
├── plan.md
├── research.md          # 17 decisions, with the real counts and the measurements they rest on
├── data-model.md
├── quickstart.md
├── contracts/api.md     # the diffs against the 007 contracts
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── setup_settings.py    # NEW: full members, aliases, menus, half-lives, minimums, setup wording
├── season_split.py      # CHANGED: rolling_checks() replaces split_three_ways(); DataError rules
├── fitting.py           # NEW: per-check Gram caches, fast exact fit and three-check validation error
├── regression.py        # CHANGED: fit() gains optional weights (the reference fit)
├── redundancy.py        # CHANGED: redundant_columns(gram_block); repeating_features() becomes a wrapper
├── selection.py         # CHANGED: Setup, check_proposal (full setup), grid search, validation winner
├── features.py          # CHANGED: batting_full_member, both_full_members; prepared columns
├── nodes.py             # CHANGED: load_data, split, explore, baseline, propose, check, fit, evaluate, grid_search, final_test
├── graph.py             # CHANGED: grid_search replaces forward_selection; actors, stages
├── state.py             # CHANGED: setup keys, grid, validation_winner; MIN constants move to setup_settings
├── llm_reply.py         # CHANGED: Proposal gains four optional setup parts
├── prompts.py           # CHANGED: schema, rules, menus, by-year and by-competition tables, per-check errors
├── llm_fake.py          # CHANGED: full setups, including a bad one for every rejection reason
├── scoring.py           # CHANGED: references on the test population; know-nothing from earlier test-population innings
├── cricket_explanation.py # CHANGED: the winning setup in cricket language
├── reference_api.py     # CHANGED: test-population innings before Y-3
├── catalogue_api.py     # CHANGED: setup_menus
├── data_table.py        # CHANGED: new columns, "Used for" labels, slices summary
├── data_notes.py        # CHANGED: notes for the new columns
├── stage_info.py        # CHANGED: choose note (hyperparameters), split note, loop note from rolling_checks
scripts/prepare_data.py  # CHANGED: team columns, membership, population, manifest, printed report
tests/
├── test_setup_settings.py     # NEW
├── test_rolling_checks.py     # NEW (replaces test_split.py's three-way cases)
├── test_fitting.py            # NEW: the fast path against the reference fit
├── test_grid_search.py        # NEW: 24 combinations, order, ties, timing
├── test_population.py         # NEW: flags, population rules, manifest counts, absent members
├── test_check_proposal.py     # CHANGED: every old and new rejection
├── test_redundancy.py         # CHANGED: the Gram criterion and the wrapper agree
├── test_no_test_year_leak.py  # CHANGED: nothing before final_test depends on the test year
├── test_final_test.py, test_agent_run.py, test_prompts.py, test_llm_reply.py, test_stage_info.py,
│   test_structure_stages.py, test_data_api.py, test_reference_api.py, test_prepare_*.py,
│   test_features_catalogue.py, test_real_data.py, test_recipe_fixture.py, test_load_data_stop.py,
│   test_failure_paths.py, test_reference_in_run.py, test_explanation_*.py   # CHANGED where they used the old split or node
web/src/page/
├── grid.ts              # NEW, pure: the grid table's model and cell labels
├── setup.ts             # NEW, pure: setup chips and check-error labels from the server's menus
├── results.ts           # CHANGED: grid panel at the grid_search step
├── leaderboard.ts       # CHANGED: setup chips and three check errors per entry
├── data-tab.ts          # CHANGED only if the new columns need it (they should not)
web/index.html           # CHANGED: the population sentence; grid and chip styles
web/tests/
├── unit/grid.test.ts, unit/setup.test.ts, unit/data-labels.test.ts  # NEW
├── e2e/*.spec.ts        # CHANGED: leaderboard chips, grid step, population sentence, Data tab columns, fallback, old self-loop
```

## Design Notes

Decisions are in `research.md`; the points that matter when building:

- **One years function**: `rolling_checks(df)` returns the test year, the three `CheckSpec`s and the test slice, and raises `DataError`. The agent, `/api/reference`, the Data tab and the stage notes all call it, so they cannot disagree.
- **A setup is four parts**: `Setup(features, window, weighting, training_innings)` with features compared as a set. It is the unit of "already tried", of the leaderboard row and of the explanation sentence.
- **Applying a setup to a check**: choose the training rows (the check's earlier years, narrowed by the window, filtered to the test population when training innings is `population`), then the weights `0.5 ** (age / half_life)` by match year. The final test does the same relative to Y.
- **Fast path and reference**: `fitting.py` solves sub-blocks of precomputed weighted Gram matrices; `regression.fit` (weighted) stays as the reference and is what `fit_model` and `final_test` use for coefficients, IQRs and chart points. A test ties them to `1e-8`.
- **One redundancy criterion**: the smallest eigenvalue of the standardised Gram block over the largest, tolerance `1e-10`, any of the three checks; `check_proposal` and the grid both use it.
- **Grid search**: one node, 24 cells in a fixed order, forward selection inside each, deterministic ties, the winning cell's build-up shown, all of it judged by the same average of three checks.
- **Winner before the test**: `grid_search` sets `validation_winner`; `final_test` only refits and scores, then marks the winner.
- **The state stays small**: the grid table is 24 short cells; per-check errors are four numbers per attempt.

## Testing Strategy

- **pytest**
  - population rules: league innings are in; a T20I is in only when both teams are full members; the league flags are 0; alias mapping (machinery tested with injected aliases); the manifest counts equal the data; the set of full members absent from the data equals the documented one;
  - `rolling_checks`: the check years and their allowed earlier years for several test years; no check reads its own or a later year; the test year's rows are absent from every check; the minimum-per-check and enough-years data errors, each through `load_data` (the run stops with the message);
  - setup application: window and weights relative to the check year; the age table in research.md; `all` windows include every earlier year; `population` excludes associates;
  - `check_proposal`: every old rejection (unknown feature, empty, too many, repeat, named twice, redundant) and every new one (missing part, unknown window, weighting and training innings, too few innings, repeat across all four parts with features as a set); two setups differing only in an inert option are both allowed;
  - fast fit: matches the reference weighted fit for random subsets, weightings, windows, innings choices and checks; the validation errors equal an independent calculation;
  - redundancy: the Gram criterion matches the SVD wrapper on every feature pair and on sampled sets; `check_proposal` and the grid agree on a redundant set;
  - grid: exactly 24 combinations, the same ones in the same order on every run; deterministic ties; a thin table marks a cell "too few innings"; the whole grid in at most 3.0 s on the committed data;
  - winner: chosen on validation, tie to the language model, grid's best when the model is absent; `final_test` scores both best setups once on the test-population innings of Y and the two references there; the know-nothing guess is the mean of test-population innings before the year scored;
  - leakage: replacing every value in the test year changes nothing in any state before `final_test`; a spy shows the test slice is requested only inside `final_test`;
  - prompts: the menus, by-year and by-competition tables (years before Y only) and each earlier attempt's three check errors appear; no test-year number appears;
  - `/api/reference`: figures equal an independent calculation on test-population innings before Y−3 and ignore every later year; `/api/catalogue` carries `setup_menus`; the Data tab endpoint carries the new columns and the "Used for" values; the structure notes name the three check years and the test year and contain the hyperparameter wording;
  - preparation: team columns, flags, population and the printed report on fixtures; `--from-existing` fails clearly.
- **Vitest**: the grid table model (cells, best cell, cell labels), setup chips and check labels from the menus, the "Used for" label mapping.
- **Playwright**
  - every leaderboard entry shows the setup chips and the three check errors labelled by year;
  - the grid step renders 24 cells in two grids with the best cell outlined, and the outline survives a greyscale render;
  - the introduction's population sentence is present and contains no digit;
  - the Data tab has the new columns (descriptions, sort, filter, CSV) and the three "Used for" values;
  - the language-model fallback completes with the grid and says the model was absent;
  - the stage notes show the hyperparameter wording and the old "later apps" wording is gone;
  - every existing test that expected the `forward_selection` self-loop is updated.
- **Whole-run timing**: the scripted agent run end to end on the committed data (load, model loop, grid, final test, explanation) completes in at most 15 seconds, so SC-006 is checked automatically and not only by the live run.
- **Live check** (once, in `quickstart.md`): one run with the default language model finishes inside the limit and reports check errors for its setups (SC-006).
- **Existing tests**: only those that depend on the single validation year, the old population or the `forward_selection` node are updated; the 007 test limiting the visible introduction to 120 words is re-measured after the new sentence is added and its limit moves, with the reason recorded, only if needed.

## Risks

- **Afghanistan is absent from the source**: the data cannot hold all twelve members (research.md Decision 2). Handled with a test of the exact documented gap and a script warning; the owner may want a different source later.
- **The stage number in the brief**: it says stage 6; the grid belongs to stage 5 (Decision 9). One line to change.
- **Data refresh moves the figures**: a fresh download adds matches since 2026-10-04 and the new population changes the introduction's figures and the meter; fixtures with typed expectations are listed in `tasks.md`.
- **Test year is partial**: 2026 is mid-year (166 population innings against a minimum of 100). The rule is data-driven, so a later refresh needs no change; a thin year stops the run with a clear error.
- **Check-year noise**: three checks of about 190 innings each are still noisy; the page shows every check's error so the visitor can see the spread (confidence ranges are out of scope).
- **Timing margin**: the 0.5 s figure is an estimate from measured parts; the 3.0 s test is the proof (it retries once and its limit can be raised through an environment variable for a slow machine), and if it fails the cache layout (not the menus) is the thing to improve.
- **Size of the change**: about 25 backend modules and ten web files touch the split; `tasks.md` stages it so the suite stays runnable (settings and checks first, then fitting, then the node swap, then the page).

## Complexity Tracking

| Departure or addition | Reason |
|---|---|
| `fitting.py` beside `regression.fit` | The reference fit is too slow for a 24-combination search (about 38 s); the Gram path is exact and about 100 times cheaper; a test ties them |
| A second redundancy entry point | The SVD path cannot run inside the search; one shared criterion serves both uses and the old function becomes a wrapper |
| `check_proposal` takes the data | The checks need the rolling training rows to judge too-few-innings and redundancy in all three checks |
| The grid search is one node | One readable event instead of 24 loop visits; keeps the graph's edges simple |
| `Proposal` parts are optional in parsing | A missing part must be rejected with its own reason, not make the whole reply unusable |
| The winner is set before `final_test` | Choosing on validation error removes the test year from the choice (a behaviour change from today, recorded in the spec) |
| `grid_search` is in stage 5, not 6 | Stage 5 is where setup choice lives (Decision 9) |
