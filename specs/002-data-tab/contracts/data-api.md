# Contract: `GET /api/data`

Returns the prepared innings table, its column definitions and its summary in one JSON document. Read-only; no parameters.

## Response `200 application/json`

```json
{
  "columns": [
    {"key": "match_id", "label": "Match ID", "description": "Cricsheet's identifier for the match.", "type": "integer"},
    {"key": "match_date", "label": "Match date", "description": "Date the match was played.", "type": "date", "filter": "year"},
    {"key": "competition", "label": "Competition", "description": "Which competition the match belongs to.", "type": "text",
     "labels": {"t20i": "T20 International", "ipl": "IPL", "bbl": "BBL"}, "filter": "select"},
    {"key": "used_for", "label": "Used for", "description": "Whether the agent trains on this innings or is tested on it.", "type": "text",
     "labels": {"training": "Training", "test": "Test"}, "filter": "select"}
  ],
  "rows": [
    [211048, "2005-02-17", "2004/05", "t20i", "Eden Park", 89, 4, 58, 214, "training"]
  ],
  "summary": {
    "headline": [
      {"label": "Innings", "value": "5,146"},
      {"label": "Dates", "value": "17 Feb 2005 to 30 Sep 2026"},
      {"label": "Downloaded from Cricsheet", "value": "1 Oct 2026"}
    ],
    "sections": [
      {"title": "Innings per competition", "rows": [{"label": "T20 International", "value": "3,317"}]},
      {"title": "Excluded, and why", "rows": [{"label": "No result", "value": "97"}]}
    ],
    "attribution": "Ball-by-ball data from Cricsheet (https://cricsheet.org), used under the Open Data Commons Attribution License.",
    "attribution_url": "https://cricsheet.org",
    "file_stem": "t20-first-innings",
    "file_date": "2026-10-01"
  }
}
```

(The example shows a subset of the columns; the real response has all ten, listed in `data-model.md`.)

## Rules

- `rows[i]` has exactly `len(columns)` values, in column order; values are raw (the `labels` map is applied by the client).
- Row order equals `data/innings.csv`. Dates are `YYYY-MM-DD`.
- `used_for` is computed by the backend with `season_split.split_by_year`. Clients must not recompute it.
- Headline and section values are preformatted display strings; their counts come from `data/manifest.json`.
- `summary.file_date` is the manifest's `download_date`.

## Errors

| Status | When | Body |
|---|---|---|
| 500 | Data file missing or unreadable (`DataError`) | `{"detail": "<plain-English message>"}` |

The client treats any non-200 response or network failure as a load failure: it shows the message and a Retry button on the Data tab only.

## Caching

`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (set in `vercel.json`, and by the router for local use). The data only changes with a deploy.

## Client modules' contract (`<tab-set>` and `<data-grid>`)

`<tab-set>`

- Children: elements with `data-tab` (id) and `data-label` (tab text). It builds the tab list from them and never moves or re-creates them.
- Attribute `default-tab` (default: first). Active tab lives in `location.hash` (`#<id>`); unknown or empty hash selects the default using `replaceState`.
- Events (bubble): `tab-hide` and `tab-show`, `detail: {id}`, dispatched before hiding and after showing.
- ARIA tabs pattern: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`, arrow keys, Home and End move focus and select.

`<data-grid>`

- Properties: `table` (a `DataTable`, setting it renders); `setLoading()`, `setError(message)` with a `retry` event emitted when Retry is pressed.
- Contains: summary, column guide, search, filters, "Showing X of Y innings" (the noun comes from a `noun` attribute, default "rows"), download control with the all/rows-shown choice, attribution note, empty state with "Clear filters".
- Listens for `tab-hide` and `tab-show` on its ancestors to save and restore scroll and redraw.
- Contains no reference to cricket or regression; the only library import is in `grid-adapter.ts`.
