# Linear regression agent app

Predicts a T20 first innings' final total from the score at 10 overs and lets a visitor watch the agent's graph solve it step by step.

Data: ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Data tab

The page has two tabs, **Working** (the agent graph, results and try-your-own) and **Data**: the innings table the agent uses, as a read-only spreadsheet-style grid with sort, search, competition/year/training-or-test filters, a summary from `data/manifest.json`, and a CSV download. Each tab has its own link (`#working`, `#data`).

- `GET /api/data` returns `{columns, rows, summary}` (`backend/linreg/data_api.py`, built for this app by `data_table.py`). The "Used for" column comes from `season_split.split_by_year`, so it always matches the agent's split.
- `web/src/tab-set/` (`<tab-set>`) and `web/src/data-grid/` (`<data-grid>`) are reusable and know nothing about cricket or regression; see their READMEs. The grid library (Tabulator) is imported only in `data-grid/grid-adapter.ts`.
- Spec, plan and tasks: `specs/002-data-tab/`.

## Competition dummy columns

`data/innings.csv` has two 0/1 columns right after `competition`: `is_ipl` (1 for an IPL innings) and `is_bbl` (1 for a BBL innings). T20 International is the reference category: both are 0. A linear regression can only do arithmetic with numbers, so a text category needs columns like these. The Data tab shows them and explains them; **the model does not use them yet**.

- The mapping is defined once, in `backend/linreg/competition_dummies.py`. The preparation script, the `load_data` check, the Data tab columns and the tests all import it. `tests/test_boundaries.py` enforces that.
- They are created by `scripts/prepare_data.py`, never by hand or by the app. An unrecognised competition stops the script with an error and nothing is written; both output files are written to temporary files first. `data/manifest.json` has a `dummies` entry (the columns, the competition each stands for, and the reference).
- To add the columns to existing data without downloading: `uv run python scripts/prepare_data.py --from-existing` (keeps the same innings, order and download date). A normal run downloads fresh data.
- `load_data` checks every row (each value 0 or 1, agreeing with `competition`) and stops the run with a clear count of wrong rows; a file without the columns fails with the usual "missing columns" error.
- `tests/fixtures/golden_run.json` is the agent's run recorded before this change; `tests/test_run_unchanged.py` proves the run is identical.

See `specs/001-linear-regression-agent/quickstart.md` for setup, running and tests.
