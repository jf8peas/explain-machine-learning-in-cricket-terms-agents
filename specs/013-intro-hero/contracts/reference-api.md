# Contract: GET /api/reference (extended) and the hero's page contract

Existing fields (`goal`, `methods`, `training`, `figures`, `gap`, `finding`, `words`, `sentences`, `meter`, `message`) are unchanged. Cache headers unchanged.

## New fields

```json
{
  "average_total": 162,
  "example": {
    "match_id": "1223954",
    "batting_team": "...", "bowling_team": "...", "venue": "...",
    "date": "2020-12-08", "date_label": "December 2020",
    "runs": [/* 20 cumulative values */], "wickets": [/* 20 cumulative values */],
    "runs_at_10": 82, "wickets_at_10": 2, "final_total": 186,
    "tv_projection": 164, "tv_miss": 22.0, "wicket_overs": [2, 10, 19, 20]
  },
  "hero": {
    "caption": "...", "panel": "...", "panel_emphasis": ["too low"], "footnote": "...", "chart_text": "..."
  }
}
```

The values shown are the README's illustration, not fixed data.

## Fault behaviour

| Situation | Response |
|---|---|
| data cannot be read | existing `_unavailable()` shape; `average_total`, `example`, `hero` are `null` |
| example id missing, outside the introduction's years or population, or not 20 overs | warning logged; `example: null`; `hero.caption` and `hero.chart_text` `null`; rest intact |

## Page contract (test ids)

| Test id | Element |
|---|---|
| `breadcrumb` | nav above `tab-set`; first link to the site, then "Linear regression" |
| `hero`, `hero-title` | the section and its `h1` |
| `worm-card`, `worm-chart`, `worm-chart-svg`, `worm-caption`, `worm-key` | chart card, its host, the SVG (`role="img"`, `aria-label` = `hero.chart_text`, `data-mode` = `side` or `key`), `figcaption`, the key shown under a narrow chart |
| `worm-end-label` (`data-series`) | actual, tv, nothing, agent (in the SVG beside a wide chart, in `worm-key` under a narrow one); also `worm-dot-label`, `worm-miss-label`, `worm-wicket` (`data-over`), `worm-final`, `worm-axis-label` |
| `tv-panel`, `tv-miss`, `nothing-miss`, `tv-sentence`, `tv-footnote` | the panel and its parts (`panel_emphasis` phrases are shown in bold inside `tv-sentence`) |
| `hero-steps` | the three steps |
| `hero-unavailable` | plain "figures could not be loaded" state |

Removed test ids: `intro-lead`, `reference`, `meter*`, `chips`, `intro-full`, `reference-details`, `reference-detail`, `reference-row`, `catalogue` (and children). Kept: `model-picker`, `variation-note`, `run-summary`.
