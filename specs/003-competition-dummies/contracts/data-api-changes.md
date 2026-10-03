# Contract changes: `GET /api/data`

Builds on `specs/002-data-tab/contracts/data-api.md`. Only the differences are listed.

## `columns`

Two columns are added immediately after `competition`, so the full order is `match_id, match_date, season, competition, is_ipl, is_bbl, venue, runs_at_10, wickets_at_10, powerplay_runs, final_total, used_for`:

```json
{"key": "is_ipl", "label": "IPL (0/1)", "type": "integer", "filter": "select",
 "description": "1 if the innings was an IPL innings, otherwise 0. A T20 International innings has 0 here and 0 in BBL (0/1)."},
{"key": "is_bbl", "label": "BBL (0/1)", "type": "integer", "filter": "select",
 "description": "1 if the innings was a BBL innings, otherwise 0. A T20 International innings has 0 here and 0 in IPL (0/1)."}
```

Rows carry the two values (integers 0 or 1) in the same positions. As before, `rows[i]` equals the row of `data/innings.csv` (plus `used_for` last); the CSV file has the same column order.

A `select` filter on a numeric column compares the chosen option (`"0"` or `"1"`) with the value as text; its options are the distinct values present, in ascending order.

## `notes` (new, optional)

A top-level list next to `columns`, `rows` and `summary`. The viewer renders each note as a collapsible section, closed by default, beside the column guide. It interprets none of the text.

```json
"notes": [
  {
    "title": "What are dummy variables?",
    "paragraphs": ["A dummy variable is a yes/no question about an innings, written as a number…", "…"],
    "example": {
      "caption": "Three real innings from this table, one per competition",
      "columns": ["Competition", "IPL (0/1)", "BBL (0/1)"],
      "rows": [["T20 International", "0", "0"], ["IPL", "1", "0"], ["BBL", "0", "1"]]
    }
  }
]
```

| Field | Type | Rule |
|---|---|---|
| `notes[].title` | string | Required; the section heading |
| `notes[].paragraphs` | string[] | Required; plain text, shown in order |
| `notes[].example` | object | Optional; a small table |
| `example.caption` | string | Optional |
| `example.columns` | string[] | Column headings |
| `example.rows` | string[][] | Each row has one value per column, as display text |

The server builds the example rows from real rows of the loaded data (the first row of each competition in file order), so they always agree with the table.

## Errors

A data file without `is_ipl` or `is_bbl`, or whose dummy values fail the every-row check, gives HTTP 500 `{"detail": "<plain-English message>"}`, the same shape as before. The Data tab shows it in its existing load-failure state with Retry.

## Agent stream (`/api/run`)

No change to the stream's shape. For the committed data its events are identical to before this feature. For a bad or older data file, the `load_data` event reports the same kind of data error as other unusable data and the run stops.
