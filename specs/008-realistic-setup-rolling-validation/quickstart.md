# Quickstart: A Realistic Setup and a Steadier Judge

Run from `apps/linear_regression/` unless noted. No new dependency or environment variable.

## Refresh the data (once, needs the network)

```bash
uv run python scripts/prepare_data.py
```

This downloads the three Cricsheet files, rebuilds `data/innings.csv` and `data/manifest.json` with the team columns, and prints the non-member T20I team names. Check:

- The printed list has no spelling of a full member (if one appears, add it to `TEAM_ALIASES` in `backend/linreg/setup_settings.py` and run again).
- It warns that **Afghanistan** never appears (the source does not carry it today); that is the documented gap, not a failure.
- `data/manifest.json` has `full_members`, `team_aliases`, `absent_full_members` and `population` whose `in` plus `out` equals `counts.total_innings`.

`--from-existing` cannot add team names and stops with a clear message.

## Run locally

With the scripted model (no key, no network). On this machine start the API with `python -m uvicorn`:

```bash
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run python -m uvicorn api.index:app --port 8000
cd web && npm install && npm run dev
```

Open `http://localhost:5173/`.

## What to look at

1. **The introduction**: one new sentence says the agent is tested on IPL and BBL innings and on T20 internationals between ICC full members. The meter's numbers have moved (they are now on population innings before the first check year).
2. **The stage notes** (click stage 5, Choose the setup): the note explains that the training window and recency weighting are hyperparameters, chosen before fitting rather than learned, and that this is the first time the site tunes them. Stage 2 (Split the data) names the three check years and the test year.
3. **A run** (Play): the model proposes full setups; rejected ones show their reason (the scripted model produces one for each reason). One `grid_search` step replaces the old repeating forward-selection steps.
4. **The grid**: at the grid step, two small grids (full-member and league innings only, then all innings), rows are the four windows, columns the three weightings, each cell its average validation error, the best cell outlined (and bold, so it survives greyscale). Below it, the winning cell's feature-by-feature build-up.
5. **The leaderboard**: every entry shows chips for its features, window, weighting and training innings, its average error, and the error in each of the three check years.
6. **The result**: both models are scored once on the test year; the winner is the one with the lower validation error (decided before the test year was read), and the explanation states its setup in cricket language.
7. **The Data tab**: new columns (batting and bowling team, full-member flags, in test population) with descriptions, sort and filter; "Used for" reads Test, "Training and validation" and Training; the summary shows how the years are used and the population counts.
8. **The fallback**: choose the model option that fails (or run without a key): the run completes with the grid and the results say the language model was absent.

## Timing and the live check (SC-006, needs a key)

```bash
uv run pytest tests/test_grid_search.py -k timing    # the complete grid in at most 3.0 s
```

Then, once, with the real key in `.env` (never printed) and the default model, run the app and press Play: the run must finish inside the limit, report three check errors for each setup, and show the winning setup. Record the elapsed time in `specs/008-realistic-setup-rolling-validation/checklists/requirements.md` notes.

## Reader check (SC-005, needs a person)

Show someone the finished result and ask which seasons and innings the winner learned from, how recent seasons were weighted, and which check year was hardest. Record the outcome in the same notes.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test      # starts the API with the fake model and the in-memory store
cd web && npm run build
```
