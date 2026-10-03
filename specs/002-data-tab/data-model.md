# Data Model: Data Tab

The generic types (`ColumnDef`, `DataTable`, `DataSummary`, `ViewState`) live in the reusable modules and mention no cricket. The cricket columns appear only as the backend's configuration for this app.

## ColumnDef

| Field | Type | Meaning |
|---|---|---|
| `key` | string | Stable identifier, unique in the table |
| `label` | string | Friendly heading shown in the grid and CSV |
| `description` | string | What the column means (hover/focus text and the column guide) |
| `type` | `"text"` \| `"integer"` \| `"number"` \| `"date"` | Drives alignment (numbers right-aligned), sorting (numeric, date, text) and CSV formatting |
| `labels` | map string to string (optional) | Display text for raw values (for example `t20i` to "T20 International") |
| `filter` | `"select"` \| `"year"` (optional) | Show a dropdown of the column's display values, or a year dropdown from a `date` column |

Validation: `key`s unique; at most one filter per column; a `year` filter requires `type: "date"`.

## DataTable

`{ columns: ColumnDef[], rows: Value[][], summary: DataSummary }`. Each row has one value per column, in column order. Values are raw (string, number or null). Order of `rows` is the "original order".

## DataSummary

| Field | Type | Meaning |
|---|---|---|
| `headline` | `{label, value}[]` | Key figures (total innings, date range, downloaded on) |
| `sections` | `{title, note?, rows: {label, value}[]}[]` | Titled lists (innings per competition; excluded matches and why). The optional `note` explains the section; the exclusions note says they were decided before the agent runs, by `scripts/prepare_data.py` |
| `attribution` | string | Source and licence note, shown beside the download button and on the tab |
| `attribution_url` | string (optional) | Link for the source name |
| `file_stem` | string | File name prefix (`t20-first-innings`) |
| `file_date` | string `YYYY-MM-DD` | The data's download date, used in the file name |

## ViewState (browser only, kept in memory while the page is open)

| Field | Meaning |
|---|---|
| `search` | Text typed in the search box |
| `filters` | Map of column key to chosen value; the year filter holds a year |
| `sort` | `{key, direction}` or null (original order); clicking cycles ascending, descending, none |
| `selection`, `scroll` | Owned by the adapter and saved/restored around tab hide/show |

Derived: `visibleRows = sort(filter(rows, columns, state))`. The row number column is the 1-based index into `visibleRows`.

## Backend configuration for this app (cricket-specific, not in the reusable modules)

Column order and content, built from `data/innings.csv`:

| key | label | type | labels / filter |
|---|---|---|---|
| `match_id` | Match ID | integer | |
| `match_date` | Match date | date | `filter: "year"` |
| `season` | Season | text | |
| `competition` | Competition | text | labels t20i to T20 International, ipl to IPL, bbl to BBL; `filter: "select"` |
| `venue` | Venue | text | |
| `runs_at_10` | Runs at 10 overs | integer | |
| `wickets_at_10` | Wickets at 10 overs | integer | |
| `powerplay_runs` | Powerplay runs (overs 1-6) | integer | |
| `final_total` | Final total | integer | |
| `used_for` | Used for | text | values `training`, `test`; labels Training, Test; `filter: "select"` |

`used_for` is computed with `split_by_year`: rows in the latest calendar year of `match_date` are `test`, earlier rows are `training`. It is the only derived column.

Summary built from `manifest.json`: headline total innings (`counts.total_innings`), date range (min and max `match_date`), downloaded on (`download_date`); one section "Innings per competition" (`innings_kept` per competition); one section "Excluded, and why" summing `excluded` counts across competitions with plain-English reasons (no result, DLS, reduced overs, ended before 10 overs; zero-count reasons omitted); `attribution` from the manifest; `file_stem` `t20-first-innings`; `file_date` from `download_date`.

## Relationships and invariants

- `rows` equals `innings.csv` row for row (same values, same order) plus `used_for`.
- `summary` total equals `len(rows)` equals the agent's `load_data` row count.
- Training and test counts equal the agent's split counts.
