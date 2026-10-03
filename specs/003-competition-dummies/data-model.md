# Data Model: Competition Dummy Variables

## Competition dummy mapping (defined once, in `backend/linreg/competition_dummies.py`)

| Dummy column | Competition it represents | Value |
|---|---|---|
| `is_ipl` | `ipl` | 1 for an IPL innings, otherwise 0 |
| `is_bbl` | `bbl` | 1 for a BBL innings, otherwise 0 |
| (none) | `t20i`, the reference category | both dummies are 0 |

Order is fixed: `is_ipl` then `is_bbl`.

## Prepared innings table (`data/innings.csv`)

One row per first innings. Column order after this feature (the dummies are immediately after `competition`):

`match_id, match_date, season, competition, is_ipl, is_bbl, venue, runs_at_10, wickets_at_10, powerplay_runs, final_total`

| Rule | Detail |
|---|---|
| `is_ipl`, `is_bbl` | integers, only 0 or 1 |
| Agreement | `is_ipl == 1` exactly when `competition == "ipl"`; `is_bbl == 1` exactly when `competition == "bbl"` |
| Exclusivity | never both 1 |
| Reference | `competition == "t20i"` exactly when both are 0 |
| Unchanged | all other columns, the row order and the set of innings are identical to before |

Counts: the number of rows with `is_ipl == 1` equals the manifest's `counts.ipl.innings_kept`; likewise for BBL; rows with both 0 equal `counts.t20i.innings_kept`.

## Manifest (`data/manifest.json`)

Everything stays as it is (download date, sources, counts, attribution), plus one new entry:

```json
"dummies": {
  "reference": "t20i",
  "columns": { "is_ipl": "ipl", "is_bbl": "bbl" }
}
```

## Validation (`check_dummies`)

A row is counted wrong, once, if any of these holds:

1. a dummy value is missing or is not 0 or 1;
2. both dummies are 1;
3. a dummy differs from the value its competition requires;
4. the competition is not `t20i`, `ipl` or `bbl`.

If the count is above zero it raises `DataError`: "`N` rows have competition columns (is_ipl, is_bbl) that do not match their competition." A file missing either column never reaches the check: loading fails first with the existing "missing columns" message.

## `/api/data` payload additions

- Two `ColumnDef`s after `competition`: `is_ipl` and `is_bbl`, type `integer`, `filter: "select"`, labels "IPL (0/1)" and "BBL (0/1)".
- A new optional top-level `notes` list (generic, see the contract): `{ title, paragraphs: string[], example?: { caption?, columns: string[], rows: string[][] } }[]`.

## Note for this app

One note, "What are dummy variables?": paragraphs covering FR-012 to FR-014, and an `example` with columns `Competition`, `IPL (0/1)`, `BBL (0/1)` and three rows built from the first row of each competition in the loaded data (T20 International, IPL, BBL).

## Unchanged

Run state, the model features (`FEATURE_ORDER`), the train/test split and every agent output.
