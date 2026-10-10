# Linear regression agent app

Predicts a T20 first innings' final total from the score at 10 overs and lets a visitor watch the agent's graph solve it step by step.

Data: ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Data tab

The page has five tabs, in the order of the process: **Data**, **Working**, **What the agent found**, **The final test** and **Try your own innings** (links `#data`, `#working`, `#found`, `#final-test`, `#try-your-own`). Working, shown first, holds the introduction, model picker, agent graph and a one-line summary of the best setup so far; the results are in the three tabs after it, filled in as the replay shows them, with a marker on a tab when its content is ready. When the replay reaches its last step the page moves to What the agent found, once per run (not on a failed run). Data is the innings table the agent uses the agent uses, as a read-only spreadsheet-style grid with sort, search, competition/year/training-or-test filters, a summary from `data/manifest.json`, and a CSV download. Each tab has its own link (`#working`, `#data`).

- `GET /api/data` returns `{columns, rows, summary}` (`backend/linreg/data_api.py`, built for this app by `data_table.py`). The "Used for" column (training, training and validation, or test) comes from `season_split.rolling_checks`, so it always matches the agent's checks; a separate column shows whether each innings is in the test population.
- `web/src/tab-set/` (`<tab-set>`) and `web/src/data-grid/` (`<data-grid>`) are reusable and know nothing about cricket or regression; see their READMEs. The grid library (Tabulator) is imported only in `data-grid/grid-adapter.ts`.
- Spec, plan and tasks: `specs/002-data-tab/`. Feature 004: `specs/004-llm-feature-selection/`.

## How good is the reference?

Every prediction is scored against actual final totals in the same four ways: the **average miss** in runs, the **hit rate** (the share of innings within 10 and within 20 runs), the **miss as a share of a typical total**, and the **bias** (whether it guesses too high or too low). `backend/linreg/accuracy.py` does the sums (generic, unrounded, one rounding step for display); `accuracy_text.py` puts them into cricket words.

- **Four methods, defined once** in `backend/linreg/methods.py`: the know-nothing guess (the training years' average total, `evaluation.know_nothing_guess`), the TV projection, the language model's model and forward selection's model. The **goal** (beat the TV projection by at least `MARGIN_RUNS` runs) and the verdict are defined once in `goal.py`; the introduction, the verdict and the explanation all take their wording from there, so nothing about the goal is typed in `web/index.html`.
- **Before a run**: `GET /api/reference` gives the introduction the two references' figures on the **test-population innings before the first check year** (`reference_api.py`; changing a check year or the test year changes nothing in it).
- **The introduction's miss meter** (feature 007): one lead line and a number line of average miss with three marks (the know-nothing guess, the TV projection and the goal, which is the projection's displayed miss minus `MARGIN_RUNS`). The server works out every number, the scale, the labels, the caption, the text equivalent and the lead sentence (`goal.meter()` and `goal()['lead']`, sent in `/api/reference`); the page only turns a value into a position (`web/src/page/meter.ts`). The original two paragraphs and the table of full figures sit in two closed sections.
- **At the end**: `final_test` scores all four methods once on the test-population innings of the test year (`scoring.py`) and adds the figures, the verdict, the findings and the chart points to the final state; the page shows a side-by-side table, a predicted-versus-actual chart (`web/src/page/accuracy-chart.ts`, hand-built SVG) and the explanation compares the winner with all three references.
- A pair of methods can predict identically; both stay in the results and on the chart. If every method that uses the score at 10 overs leans the same way by a lot (`LARGE_BIAS_SHARE` in `accuracy.py`), the results say so.
- Spec, plan and tasks: `specs/006-reference-accuracy/`.

## Machine learning stages

Every step of the agent belongs to one of eight stages of a machine learning project (prepare the data, split the data, understand the data, frame the problem, choose the setup, fit the model, final assessment, interpret and communicate, numbered 1 to 8 in the order a run first reaches them). The graph shows each node's stage with a numbered, coloured badge, groups neighbouring nodes of a stage in labelled bands, and has a legend that highlights one stage. The detail panel and the timeline show the stage too.

- The stage set is defined once, in `backend/linreg/stages.py`, for every algorithm app. It reaches the page inside `GET /api/structure`; the visualiser holds no stage text.
- To give a node a stage, add it to `NODE_STAGES` in `backend/linreg/graph.py`. `check_stages(app, mapping)` (used by `tests/test_structure_stages.py`) fails if a node has no stage, an unknown stage, or the mapping names something that is not a node. Another app calls the same function with its own graph and mapping.
- `backend/linreg/stage_info.py` supplies this app's notes (a technical note for each of the eight stages, built from the app's constants; the general note names the validation years and the test year read from the data) and the display-only "done beforehand" item for `scripts/prepare_data.py`, built from `data/manifest.json` and the feature catalogue.
- The colours and the checks they passed (contrast, difference from the existing colours) are in `specs/005-ml-stages/research.md`; `web/tests/unit/stage-colours.test.ts` holds the values.
- Spec, plan and tasks: `specs/005-ml-stages/`.

## Competition dummy columns

`data/innings.csv` has two 0/1 columns right after `competition`: `is_ipl` (1 for an IPL innings) and `is_bbl` (1 for a BBL innings). T20 International is the reference category: both are 0. A linear regression can only do arithmetic with numbers, so a text category needs columns like these. The Data tab shows them and explains them; the agent may offer them to the language model as features.

- The mapping is defined once, in `backend/linreg/competition_dummies.py`. The preparation script, the `load_data` check, the Data tab columns and the tests all import it. `tests/test_boundaries.py` enforces that.
- They are created by `scripts/prepare_data.py`, never by hand or by the app. An unrecognised competition stops the script with an error and nothing is written; both output files are written to temporary files first. `data/manifest.json` has a `dummies` entry (the columns, the competition each stands for, and the reference).
- To add the columns to existing data without downloading: `uv run python scripts/prepare_data.py --from-existing` (keeps the same innings, order and download date). A normal run downloads fresh data.
- `load_data` checks every row (each value 0 or 1, agreeing with `competition`) and stops the run with a clear count of wrong rows; a file without the columns fails with the usual "missing columns" error.

## The agent: a language model chooses a setup

A language model proposes a **setup**; **code does everything else**. A setup has four parts: the features, the **training window** (all years, or the last 10, 5 or 3 before the year being checked), the **recency weighting** (none, gentle or strong: recent seasons count more) and the **training innings** (test-population innings only, or all innings). Graph: `load_data -> split -> explore -> baseline -> propose_features (LLM) -> check_proposal -> fit_model -> evaluate`, looping until the model says it is finished, two rounds in a row bring no improvement, or six rounds are used (rejected proposals count). Then `grid_search` (code only) runs the rival, and `final_test` refits both best setups on every year before the test year and scores each once on the test year, with the TV projection and the know-nothing guess. The explanation names the winning setup in cricket language. Every number comes from code; the model only chooses from the catalogue and the menus.

- **The innings being predicted** (feature 008): the test population is every IPL and BBL innings, plus T20 internationals where both teams are ICC full members. `scripts/prepare_data.py` records the batting and bowling teams, whether each is a full member and `in_test_population`; the full-member list, the alias map, the menus, the recency half-lives (gentle 6 years, strong 2) and the minimum innings all live in `backend/linreg/setup_settings.py`, nothing else spells them out. Cricsheet's T20 internationals file has no Afghanistan matches, so eleven of the twelve full members are in the data; a test pins that exact gap (`ABSENT_FROM_SOURCE`) and the script warns about it. The introduction says what the agent is tested on in one sentence.
- **Rolling validation**: with test year Y the checks are Y-3, Y-2 and Y-1, each trained only on the years before it (`season_split.rolling_checks`); a setup's validation error is the mean of the three. The test year is read only inside `final_test`, and the winner between the model's best setup and the rival's best is chosen on validation error before that (a tie goes to the language model). A thin check year, test year or too little earlier data stops the run at `load_data` with a clear data error.
- **Fast, exact fitting** (`fitting.py`): per check and per (window, training innings) subset the weighted Gram matrices are built once, and fitting any feature subset is a small linear solve, so the complete grid takes about 0.4 s. `regression.fit` (with optional weights) is the reference and a test holds the two to 1e-8. One redundancy rule (`redundancy.py`, the Gram block's smallest eigenvalue) serves the proposal check and the grid.
- **The rival** is a visible grid search: forward selection inside each of the 24 combinations of training innings, window and weighting (`selection.grid_search`), shown on the page as two small grids with the best cell outlined. The page names the training window and the recency weighting as hyperparameters, the first the site tunes. `tests/test_grid_search.py` proves the 24 combinations, the order and the time limit (`GRID_TIMING_LIMIT_SECONDS`, default 3 s).
- **Catalogue**: 19 features, measured or derived by declarative recipes in `recipes.py` (mirrored in `web/src/page/recipes.ts` and checked by a shared fixture), including `batting_full_member`, `bowling_full_member` and `both_full_members` (inside the population the last equals "neither IPL nor BBL", so the redundancy check rejects it beside the two league columns). `GET /api/catalogue` serves it with the setup menus. A proposal is rejected if a part is missing, a menu choice is off the menu, a feature is outside the catalogue, the set is empty, over 8 features, already tried (all four parts, features as a set), leaves too few training innings in a check, or is numerically redundant.
- **Failure**: if the model, the key or the limit store is unavailable, the run still completes with the grid search only and says so.
- Spec, plan and tasks: `specs/008-realistic-setup-rolling-validation/`.

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

`uv run python scripts/prepare_data.py` downloads fresh Cricsheet data and rewrites `data/innings.csv` and `data/manifest.json` (all or nothing). `--from-existing` recomputes the columns without downloading (it cannot add team names and stops with a clear message if the file lacks them). The run prints every T20 international team it classified as not a full member, so a missed alias is easy to spot. `uv run python scripts/time_models.py` is an owner tool that times and prices each listed model against OpenRouter (needs the key); see `MODEL_OPTIONS.md` for the current list, results and how to run it.

See `specs/001-linear-regression-agent/quickstart.md` for setup, running and tests.
