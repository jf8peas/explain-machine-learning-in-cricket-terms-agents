# Quickstart: Linear Regression Agent App

Everything below runs from the repo root unless stated.

## 1. Set up

```bash
uv sync                                  # Python 3.12 workspace, including dev group
cd apps/linear_regression/web && npm install && cd -
```

## 2. Prepare the data (offline, only when refreshing)

```bash
uv run python apps/linear_regression/scripts/prepare_data.py
```

Writes `apps/linear_regression/data/innings.csv` and `manifest.json`. Check the manifest's exclusion counts look sensible, then commit both files.

## 3. Run locally

```bash
uv run uvicorn api.index:app --app-dir apps/linear_regression --reload      # API on :8000
cd apps/linear_regression/web && npm run dev                                  # page on :5173 (proxies /api)
```

Open the page, check the full graph is drawn, press Play, and confirm all steps appear.

## 4. Quick checks against real data

- `curl -N localhost:8000/api/run` streams `step` events then `done`.
- The final model MAE is lower than the baseline MAE on the test year (SC-001).
- Note whether runs at 10 overs alone clears the 3-run margin. If it always does, the tune loop (US5) never appears; revisit `MARGIN_RUNS` (single constant in `state.py`) before release.

## 5. Automated tests

```bash
uv run pytest apps/linear_regression/tests
cd apps/linear_regression/web && npm test && npx playwright test
```

## 6. Manual reader test (SC-004)

Show the final explanation to at least 10 people (SC-004's minimum) with no ML background, and ask each to name the feature that mattered most. Pass: at least 90% name the same feature the run ranked highest. Record results in the PR.

Measured locally (warm): all 13 steps in about 0.09 s.

## 7. Deploy

Vercel project: Root Directory `apps/linear_regression`; Ignored Build Step limits rebuilds to that directory. Regenerate `requirements.txt` from the lockfile when dependencies change. After deploying a preview, confirm `/api/run` streams incrementally (not all at once) and that the Cricsheet attribution shows on the page.
