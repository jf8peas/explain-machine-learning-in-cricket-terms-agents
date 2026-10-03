# Linear regression agent app

Predicts a T20 first innings' final total from the score at 10 overs and lets a visitor watch the agent's graph solve it step by step.

Data: ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Data tab

The page has two tabs, **Working** (the agent graph, results and try-your-own) and **Data**: the innings table the agent uses, as a read-only spreadsheet-style grid with sort, search, competition/year/training-or-test filters, a summary from `data/manifest.json`, and a CSV download. Each tab has its own link (`#working`, `#data`).

- `GET /api/data` returns `{columns, rows, summary}` (`backend/linreg/data_api.py`, built for this app by `data_table.py`). The "Used for" column comes from `season_split.split_by_year`, so it always matches the agent's split.
- `web/src/tab-set/` (`<tab-set>`) and `web/src/data-grid/` (`<data-grid>`) are reusable and know nothing about cricket or regression; see their READMEs. The grid library (Tabulator) is imported only in `data-grid/grid-adapter.ts`.
- Spec, plan and tasks: `specs/002-data-tab/`.

See `specs/001-linear-regression-agent/quickstart.md` for setup, running and tests.
