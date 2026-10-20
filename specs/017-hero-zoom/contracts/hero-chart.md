# Contract: the hero chart (extends [013](../../013-intro-hero/contracts/reference-api.md))

## `GET /api/reference`

**No field added, removed or renamed.** The chart reads `example.runs`, `example.wicket_overs`, `example.runs_at_10`, `example.wickets_at_10`, `example.final_total`, `example.tv_projection`, `average_total`, `figures.broadcaster.average_miss`, `hero.caption` and `hero.chart_text`. Only the wording of the two server sentences changes:

- `hero.caption`: "A real innings: <batting> v <bowling>, <venue>, <date>. The first 10 overs, in grey, are context; the white part is what everyone is trying to predict. <batting> went from <runs_at_10>/<wickets_at_10> to <final_total>. The TV's straight line said <tv_projection> and was <n> runs short|over[: about its typical miss]. Open circles mark wickets." When the TV equals the total: "…said <tv_projection> and was spot on." Direction and size are `final_total − tv_projection` on whole numbers (the same rule as the page's bracket).
- `hero.chart_text`: the existing sentences, plus the zoom: where the actual total, the TV projection and the know-nothing guess landed at 20 overs, the miss in words, and the TV's usual miss as a band either side of its projection.

## Page contract (test ids)

Unchanged from 013: `hero`, `hero-title`, `worm-card`, `worm-chart`, `worm-caption`, `worm-dot-label`, `worm-final`, `worm-wicket` (`data-over`), `worm-axis-label`. The SVG keeps `data-testid="worm-chart-svg"` with `role="img"` and `aria-label` = `hero.chart_text`; `data-mode` is now `wide` or `narrow`. In narrow mode there are two SVGs: `worm-chart-svg` (the line graph) and `worm-zoom-svg` (the zoom).

| Element | `data-testid` | Notes |
|---|---|---|
| Line graph panel | `worm-line` | wide: a group in the one SVG; narrow: the first SVG |
| Context band | `worm-context` | `data-over-from="0"`, `data-over-to="10"`; heading `worm-context-heading` ("CONTEXT" over "first 10 overs") |
| Prediction area | `worm-prediction` | heading `worm-prediction-heading` ("THE PREDICTION" over "where will the last 10 overs take it?") |
| The 10-over line and dot | `worm-ten` | the dotted line; `worm-dot-label` ("82/2") as before |
| Runs line, overs 0 to 10 | `worm-series-context` | `data-series="actual-first-10"`, stroke is the context-line token |
| Runs line, overs 10 to 20 | `worm-series-actual` | `data-series="actual-last-10"`, solid, text colour, label `worm-actual-label` ("what actually happened") |
| TV dashed and know-nothing dotted lines | `worm-series-tv`, `worm-series-nothing` | `data-series="tv"` and `"nothing"` as before |
| Finish line and markers | `worm-finish` | with `worm-finish-actual` (diamond, `worm-final` kept), `worm-finish-tv` (filled dot), `worm-finish-nothing` (open dot) |
| Lens box and its lines | `worm-lens`, `worm-join` | `worm-join` appears twice in wide mode and not in narrow mode |
| Zoom panel | `worm-zoom` | wide: a group in the one SVG; narrow: the second SVG's root; title `worm-zoom-title` ("ZOOM ON THE FINISH" over "total after 20 overs") |
| Ruler and ticks | `worm-zoom-ruler`, `worm-zoom-tick` | `data-value` is the tick's total |
| Zoom markers | `worm-zoom-marker` | `data-series` = `actual`, `tv`, `nothing`; shapes: diamond, filled dot, open dot |
| Zoom labels | `worm-zoom-label` | `data-series` = `actual` ("Actual 186"), `tv` ("TV 164"), `nothing` ("Know-nothing 162") |
| Usual-miss bar and key | `worm-zoom-miss`, `worm-zoom-key` | key text "TV's usual miss, ±22.5"; `data-from` and `data-to` carry the bar's totals |
| Bracket | `worm-zoom-bracket` | text `worm-zoom-bracket-words` ("22 runs short", "21 runs over" or "spot on") with `data-direction` |
| Agent box | `worm-zoom-agent` | "The agent: ?" over "where will it land?" |

Removed ids: `worm-end-label` (the end labels beside the chart and in the key), `worm-key` (the old key under a narrow chart) and `worm-miss-label` (the error bar's label). The TV's error bar is replaced by `worm-zoom-miss`.

## Layout contract

- **Wide** (card at least 560 px): one SVG. The line graph panel is 60% of the SVG's width (including its axis labels), the zoom card 39%, with a 1% gap that the two faint lens lines cross.
- **Narrow** (card below 560 px): two SVGs stacked, the line graph then the zoom at full width; no `worm-join`; no `worm-key`.
- No sideways page scroll at 360 px; nothing animates; with no example innings, caption or chart text the chart card is hidden, as today.

## Theme contract

New tokens in `:root` and the dark theme: `--context-band` (light `#eef0f3`), `--context-line` (light `#8a93a3`), `--on-accent` (the agent box's text). Text in the chart keeps 4.5:1 against its background in both themes; the context line keeps 3:1 against the context band.
