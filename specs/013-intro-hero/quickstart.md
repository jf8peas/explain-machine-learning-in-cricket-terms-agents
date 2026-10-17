# Quickstart: Intro Hero

From the repository root.

1. **Regenerate the data** (needs a network download; `--from-existing` cannot make `overs.csv`):
   `uv run python apps/linear_regression/scripts/prepare_data.py`
   Check that `data/overs.csv` exists, `manifest.json` records it with its row count, and `git diff --stat` shows `innings.csv` changed only slightly.
2. **Backend tests**: `uv run pytest apps/linear_regression/tests`
3. **Web unit tests**: `cd apps/linear_regression/web && npm test`
4. **End-to-end tests**: `cd apps/linear_regression/web && npx playwright test`
5. **Look at it**: run the app's dev server and open the Working tab. Check, in light and dark mode: the breadcrumb sits above the tab bar; the worm chart shows the example innings; the top of the model picker is visible at 1280 × 800; at 360 px there is no sideways scroll; none of the removed introduction elements remain.
6. **Fault check**: temporarily set `EXAMPLE_MATCH_ID` to an id in the check years; `/api/reference` should log a warning, send `example: null`, and the page should hide the chart card and show no numbers for it.
