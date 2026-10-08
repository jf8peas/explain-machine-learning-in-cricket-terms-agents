# Quickstart: How Good Is the Reference?

Run from `apps/linear_regression/` unless noted. No new setup, dependency or environment variable.

## Run locally

With the fake model (no key, no network):

```bash
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run python -m uvicorn api.index:app --port 8000
cd web && npm install && npm run dev
```

Open `http://localhost:5173/`. See `specs/004-llm-feature-selection/quickstart.md` for running with a real model.

## What to look at

1. **Before pressing Play**: the introduction shows the goal and a small comparison of the know-nothing guess and the TV projection on past seasons (the training years): average miss, hit rate within 10 and 20 runs, miss as a share of a typical total, and bias. It says plainly how good that bar is and how much the projection's knowledge of the score at 10 overs is worth. Play is still in view in a 1280 × 800 window.
2. **Press Play**: the Baseline step now also mentions the know-nothing guess on the validation year. The state panel never prints the chart points: it says "N items".
3. **The final test**: four rows (three if the language model did not take part) in a table with the average miss, hit rate, miss as a share of a typical total, bias in words ("guesses 6.2 runs too low") and the number of innings.
4. **The verdict**: "beat the TV projection by X runs (Y%)", and whether the 3-run goal was reached. Check it by hand from the table: the percentage is the runs divided by the projection's average miss.
5. **The chart** under the table: one open mark per test innings for each chosen method, a diagonal line for a perfect prediction. It opens with the winning model and the TV projection. Toggle methods on and off; turn them all off to see the prompt. Marks below the line are guesses that were too low.
6. **The explanation** compares the winning model with the know-nothing guess and the projection, in runs and in hit rate.
7. **The note near the results** says no method can predict a final total perfectly from the halfway mark.
8. **Themes and phone**: look in light, dark and greyscale, and at phone width. The marker shapes should tell methods apart without colour, and the page should not scroll sideways.

## Manual checks (readers)

- **SC-001** (needs a person): before any run, someone with no machine learning background reads the introduction and says how accurate the TV projection is against real totals and whether it is much better than knowing nothing.
- **SC-002** (needs a person): after a run, the same person says how the winning model compares with the know-nothing guess, the TV projection and the real totals, in runs and in hit rate.

Record both outcomes in `specs/006-reference-accuracy/checklists/requirements.md` notes.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test      # starts the API with the fake model and the in-memory store
cd web && npm run build
```
