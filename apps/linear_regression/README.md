# Linear regression agent app

Predicts a T20 first innings' final total from the score at 10 overs and lets a visitor watch the agent's graph solve it step by step.

Data: ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Data tab

The page has two tabs, **Working** (the agent graph, results and try-your-own) and **Data**: the innings table the agent uses, as a read-only spreadsheet-style grid with sort, search, competition/year/training-or-test filters, a summary from `data/manifest.json`, and a CSV download. Each tab has its own link (`#working`, `#data`).

- `GET /api/data` returns `{columns, rows, summary}` (`backend/linreg/data_api.py`, built for this app by `data_table.py`). The "Used for" column (training, validation or test) comes from `season_split.split_three_ways`, so it always matches the agent's split.
- `web/src/tab-set/` (`<tab-set>`) and `web/src/data-grid/` (`<data-grid>`) are reusable and know nothing about cricket or regression; see their READMEs. The grid library (Tabulator) is imported only in `data-grid/grid-adapter.ts`.
- Spec, plan and tasks: `specs/002-data-tab/`. Feature 004: `specs/004-llm-feature-selection/`.

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
