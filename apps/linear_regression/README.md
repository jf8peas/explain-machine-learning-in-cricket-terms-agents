# Linear regression agent app

Predicts a T20 first innings' final total from the score at 10 overs and lets a visitor watch the agent's graph solve it step by step.

Data: ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Data tab

The page has two tabs, **Working** (the agent graph, results and try-your-own) and **Data**: the innings table the agent uses, as a read-only spreadsheet-style grid with sort, search, competition/year/training-or-test filters, a summary from `data/manifest.json`, and a CSV download. Each tab has its own link (`#working`, `#data`).

- `GET /api/data` returns `{columns, rows, summary}` (`backend/linreg/data_api.py`, built for this app by `data_table.py`). The "Used for" column (training, validation or test) comes from `season_split.split_three_ways`, so it always matches the agent's split.
- `web/src/tab-set/` (`<tab-set>`) and `web/src/data-grid/` (`<data-grid>`) are reusable and know nothing about cricket or regression; see their READMEs. The grid library (Tabulator) is imported only in `data-grid/grid-adapter.ts`.
- Spec, plan and tasks: `specs/002-data-tab/`. Feature 004: `specs/004-llm-feature-selection/`.

## How good is the reference?

Every prediction is scored against actual final totals in the same four ways: the **average miss** in runs, the **hit rate** (the share of innings within 10 and within 20 runs), the **miss as a share of a typical total**, and the **bias** (whether it guesses too high or too low). `backend/linreg/accuracy.py` does the sums (generic, unrounded, one rounding step for display); `accuracy_text.py` puts them into cricket words.

- **Four methods, defined once** in `backend/linreg/methods.py`: the know-nothing guess (the training years' average total, `evaluation.know_nothing_guess`), the TV projection, the language model's model and forward selection's model. The **goal** (beat the TV projection by at least `MARGIN_RUNS` runs) and the verdict are defined once in `goal.py`; the introduction, the verdict and the explanation all take their wording from there, so nothing about the goal is typed in `web/index.html`.
- **Before a run**: `GET /api/reference` gives the introduction the two references' figures on the **training years only** (`reference_api.py`; changing the validation or test year changes nothing in it).
- **The introduction's miss meter** (feature 007): one lead line and a number line of average miss with three marks (the know-nothing guess, the TV projection and the goal, which is the projection's displayed miss minus `MARGIN_RUNS`). The server works out every number, the scale, the labels, the caption, the text equivalent and the lead sentence (`goal.meter()` and `goal()['lead']`, sent in `/api/reference`); the page only turns a value into a position (`web/src/page/meter.ts`). The original two paragraphs and the table of full figures sit in two closed sections.
- **At the end**: `final_test` scores all four methods once on the test year (`scoring.py`) and adds the figures, the verdict, the findings and the chart points to the final state; the page shows a side-by-side table, a predicted-versus-actual chart (`web/src/page/accuracy-chart.ts`, hand-built SVG) and the explanation compares the winner with all three references.
- A pair of methods can predict identically; both stay in the results and on the chart. If every method that uses the score at 10 overs leans the same way by a lot (`LARGE_BIAS_SHARE` in `accuracy.py`), the results say so.
- Spec, plan and tasks: `specs/006-reference-accuracy/`.

## Machine learning stages

Every step of the agent belongs to one of eight stages of a machine learning project (prepare the data, split the data, understand the data, frame the problem, choose the setup, fit the model, final assessment, interpret and communicate, numbered 1 to 8 in the order a run first reaches them). The graph shows each node's stage with a numbered, coloured badge, groups neighbouring nodes of a stage in labelled bands, and has a legend that highlights one stage. The detail panel and the timeline show the stage too.

- The stage set is defined once, in `backend/linreg/stages.py`, for every algorithm app. It reaches the page inside `GET /api/structure`; the visualiser holds no stage text.
- To give a node a stage, add it to `NODE_STAGES` in `backend/linreg/graph.py`. `check_stages(app, mapping)` (used by `tests/test_structure_stages.py`) fails if a node has no stage, an unknown stage, or the mapping names something that is not a node. Another app calls the same function with its own graph and mapping.
- `backend/linreg/stage_info.py` supplies this app's notes (Choose the setup is feature selection only here; the loop explanation with the training, validation and test years read from the data) and the display-only "done beforehand" item for `scripts/prepare_data.py`, built from `data/manifest.json` and the feature catalogue.
- The colours and the checks they passed (contrast, difference from the existing colours) are in `specs/005-ml-stages/research.md`; `web/tests/unit/stage-colours.test.ts` holds the values.
- Spec, plan and tasks: `specs/005-ml-stages/`.

## Competition dummy columns

`data/innings.csv` has two 0/1 columns right after `competition`: `is_ipl` (1 for an IPL innings) and `is_bbl` (1 for a BBL innings). T20 International is the reference category: both are 0. A linear regression can only do arithmetic with numbers, so a text category needs columns like these. The Data tab shows them and explains them; the agent may offer them to the language model as features.

- The mapping is defined once, in `backend/linreg/competition_dummies.py`. The preparation script, the `load_data` check, the Data tab columns and the tests all import it. `tests/test_boundaries.py` enforces that.
- They are created by `scripts/prepare_data.py`, never by hand or by the app. An unrecognised competition stops the script with an error and nothing is written; both output files are written to temporary files first. `data/manifest.json` has a `dummies` entry (the columns, the competition each stands for, and the reference).
- To add the columns to existing data without downloading: `uv run python scripts/prepare_data.py --from-existing` (keeps the same innings, order and download date). A normal run downloads fresh data.
- `load_data` checks every row (each value 0 or 1, agreeing with `competition`) and stops the run with a clear count of wrong rows; a file without the columns fails with the usual "missing columns" error.

## The agent: a language model chooses features

A language model proposes which features to try; **code does everything else**. Graph: `load_data -> split -> explore -> baseline -> propose_features (LLM) -> check_proposal -> fit_model -> evaluate`, looping until the model says it is finished, two rounds in a row bring no improvement, or six rounds are used (rejected proposals count). Forward selection (code only) then runs, and `final_test` scores the model's set, forward selection's set and the TV projection once each on the test year. The explanation names the winner and the margin. Every number comes from code; the model only names features from the catalogue.

- **Slices**: train 2005 to 2024, validation 2025 (used to choose), test 2026 (read once, in `final_test`).
- **Catalogue**: 16 features, measured or derived by declarative recipes in `recipes.py` (mirrored in `web/src/page/recipes.ts` and checked by a shared fixture). Prepared by `scripts/prepare_data.py`; `GET /api/catalogue` serves it. A proposal is rejected if it is outside the catalogue, empty, over 8 features, already tried, or numerically redundant.
- **Failure**: if the model, the key or the limit store is unavailable, the run still completes with forward selection only and says so.

### Configuration (environment variables, server only)

| Variable | Meaning |
|---|---|
| `OPENROUTER_API_KEY` | the key; read only in `llm_client.py`, never sent to the browser or logged |
| `MODEL_OPTIONS` | the owner's list of models a visitor may choose from (the first is the default). Visitors only see opaque tokens (`GET /api/models`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | the limit store (per-visitor hourly count, daily count, one-run-at-a-time lock) |
| `VISITOR_ID_SECRET` | secret for hashing a visitor's address; set it in production |
| `RUN_LIMIT_PER_HOUR` (5), `RUN_LIMIT_PER_DAY` (300), `RUN_LOCK_SECONDS` (90) | limits |
| `LLM_MAX_CALLS` and related | per-run call and time budget (`run_budget.py`); `vercel.json` sets `maxDuration` to 90 s |
| `LLM_PROVIDER=fake`, `RATE_LIMIT_STORE=memory` | development and tests only: a scripted fake model and an in-memory store. Never set in `vercel.json` |

### Running without a key (fake model)

Start the API with `LLM_PROVIDER=fake` and `RATE_LIMIT_STORE=memory` (see `web/playwright.config.ts` for the exact command). Fake model ids (`fake/steady`, `fake/quick`, `fake/slow`, `fake/markup`, `fake/broken`, `fake/timeout`) behave in fixed ways. No test reaches the network.

### Rebuilding the data

`uv run python scripts/prepare_data.py` downloads fresh Cricsheet data and rewrites `data/innings.csv` and `data/manifest.json` (all or nothing). `--from-existing` recomputes the columns without downloading. `uv run python scripts/time_models.py` is an owner tool that times and prices each listed model against OpenRouter (needs the key); see `MODEL_OPTIONS.md` for the current list, results and how to run it.

See `specs/001-linear-regression-agent/quickstart.md` for setup, running and tests.
