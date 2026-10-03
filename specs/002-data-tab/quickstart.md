# Quickstart: Data Tab

Run from `apps/linear_regression/` unless noted.

## Run the app locally

```bash
# terminal 1: API on port 8000 (the Vite proxy expects it)
uv run uvicorn api.index:app --port 8000

# terminal 2: web on port 5173
cd web && npm install && npm run dev
```

Open `http://localhost:5173/` (Working tab) and `http://localhost:5173/#data` (Data tab directly).

## Check the endpoint

```bash
curl -s http://127.0.0.1:8000/api/data | python -c "import sys,json; d=json.load(sys.stdin); print(len(d['rows']), [c['key'] for c in d['columns']], d['summary']['file_date'])"
```

Expected: 5146 rows, ten column keys ending in `used_for`, and the manifest's download date.

## Manual walkthrough

1. On Working, press Play, switch to Data and back: the run kept going.
2. On Data, click "Runs at 10 overs" three times: ascending, descending, original order.
3. Type a venue in search, pick a competition and year: "Showing X of Y innings" updates; row numbers restart at 1.
4. Choose Used for = Test: only the latest calendar year remains and the count matches the agent's test set.
5. Click Download CSV (two clicks from Working). With a filter active, choose "Rows shown": the file holds only those rows, in the shown order.
6. Open the file in Excel or Google Sheets: headings are friendly, venue names with commas are intact, accents display correctly.
7. Select a range of cells, copy, paste into a spreadsheet: clean rows and columns.
8. Press Back and Forward: tabs follow history. Open `#nonsense`: Working shows.

## Tests

```bash
uv run pytest tests/test_data_api.py       # backend
cd web && npm test                          # Vitest (table-view, csv, existing)
cd web && npx playwright test tests/e2e/data-tab.spec.ts
cd web && npm run build                     # type-check and production build
```

All existing tests must still pass.
