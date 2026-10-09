# Quickstart: verify stage rows

1. From `apps/linear_regression/web`: run the unit tests, then `npx playwright test tests/e2e/stages.spec.ts`.
2. Run the app, press Play, and compare with `design/stage-rows-1a.html`: 10 borderless tinted rows, a label column, the spine down one line, `fit_model` under `check_proposal`, the `prepare_data` item left of Start, `load_data → end` down the right margin.
3. After a full run: `load_data` shows `✓1`, repeated steps show `✓6` and the like; no blue circle.
4. Pick a stage in the legend: other rows and nodes dim; "All" restores.
5. Switch to dark mode: rows, labels and ticks stay legible.
