# Quickstart: Competition Dummy Variables

Run from `apps/linear_regression/` unless noted.

## Update the committed data (once, for this feature)

```bash
uv run python scripts/prepare_data.py --from-existing
git diff --stat data/
```

This reads the current `data/innings.csv`, adds `is_ipl` and `is_bbl` right after `competition`, adds the `dummies` entry to `data/manifest.json`, and changes nothing else: same innings, same order, same download date, no network. Expect `innings.csv` to gain two columns and `manifest.json` to gain one entry.

A normal run (`uv run python scripts/prepare_data.py`, no flag) downloads fresh data from Cricsheet and produces the same columns. If the script meets an unknown competition it stops with an error naming it and leaves the existing files as they were.

## Check the data

```bash
head -3 data/innings.csv
python -c "import json; print(json.load(open('data/manifest.json'))['dummies'])"
```

Expected header: `match_id,match_date,season,competition,is_ipl,is_bbl,venue,…`, and `{'reference': 't20i', 'columns': {'is_ipl': 'ipl', 'is_bbl': 'bbl'}}`.

## Run the app

```bash
# terminal 1
uv run uvicorn api.index:app --port 8000
# terminal 2
cd web && npm install && npm run dev
```

Open `http://localhost:5173/#data`.

## Manual walkthrough

1. The grid has "IPL (0/1)" and "BBL (0/1)" right after Competition. IPL rows show 1 and 0, BBL rows 0 and 1, T20 International rows 0 and 0.
2. Hover or focus a dummy heading: its description appears; the column guide lists it too.
3. Set Competition = IPL and IPL (0/1) = 1: all IPL rows. Set Competition = IPL and BBL (0/1) = 1: no rows and the empty state with "Clear filters".
4. Search "IPL": only IPL rows.
5. Open "What are dummy variables?" (it starts closed): the explanation, the three-row example (T20 International, IPL, BBL), and the line saying the model does not use these columns yet. Check that someone with no machine learning background can say why there are two columns for three competitions.
6. Download CSV: the file has the two columns after Competition.
7. On the Working tab, press Play: the run is exactly as before.
8. Older file check: point the app at a copy of the old `innings.csv` (without the dummies) and run the agent: `load_data` stops with a "missing columns" message.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test
cd web && npm run build
```
