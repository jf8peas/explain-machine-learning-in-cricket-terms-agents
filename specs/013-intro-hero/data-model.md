# Data Model: Intro Hero

## overs.csv (new, `apps/linear_regression/data/overs.csv`)

One row per kept first innings per over bowled. Ordered as `innings.csv`, then by over.

| Column | Type | Rule |
|---|---|---|
| match_id | text | joins to `innings.csv` |
| over | int 1–20 | an over that was bowled; an all-out innings has fewer than 20 |
| runs | int | cumulative runs at the end of that over (all deliveries, extras included) |
| wickets | int | cumulative dismissals at the end of that over (`retired hurt` / `retired not out` excluded, as for `wickets_at_10`) |

Invariants (tested): for every innings, `runs` and `wickets` never decrease; at over 10 they equal `runs_at_10` and `wickets_at_10`; at over 20 `runs` equals `final_total`. `manifest.json` gains `overs: {file, rows}`. Not shown on the Data tab; not in the CSV download.

## Settings

`EXAMPLE_MATCH_ID = 1223954` in `backend/linreg/settings.py`.

## Example (inside `/api/reference`, or `null`)

| Field | Meaning |
|---|---|
| match_id | the configured id |
| batting_team, bowling_team, venue | from `innings.csv` |
| date | ISO date; `date_label` ("December 2020") is used by the caption |
| runs, wickets | arrays of 20 cumulative values, over 1 to 20 |
| runs_at_10, wickets_at_10, final_total | from `innings.csv` |
| tv_projection | `runs_at_10 × 2` |
| tv_miss | `abs(final_total − tv_projection)`, one decimal |
| wicket_overs | overs in which at least one wicket fell, each once, ascending |

`null` (with a logged warning, rest of response intact) when the id is absent from `train` or from `overs.csv`, falls outside the introduction's years or population, has other than 20 overs, or its over-10 / over-20 values disagree with `innings.csv`.

## Figures used (existing, plus one)

`figures.know_nothing.average_miss`, `figures.broadcaster.average_miss`, `figures.broadcaster.bias`, `training.{first_year,last_year,innings}`, `goal.margin_runs`; new: `average_total` (whole runs).

## Hero block (inside `/api/reference`, or `null` when figures are unavailable)

| Field | Rule |
|---|---|
| caption | README caption; "about its typical miss" only when `abs(tv_miss − tv_average_miss) ≤ 0.25 × tv_average_miss`; `null` if example is null |
| panel | "Knowing the score at 10 overs barely helps the TV…" with "barely helps" only when `0 < (know_nothing_miss − tv_miss_avg) / know_nothing_miss ≤ 0.10`; when the gap is zero or negative the sentence says plainly that the TV is no better than knowing nothing; direction and no-direction wording follow `accuracy_text`'s bias rules ("on average it guesses too low, by N runs"; "leans neither way on average" when the bias rounds to 0.0); goal margin from `goal.margin_runs` |
| footnote | "<N> past innings, <first> to <last>: IPL, BBL and full-member internationals." |
| panel_emphasis | phrases inside `panel` to show in bold (the direction, "too low" or "too high"; empty when no direction is claimed) |
| chart_text | the chart's accessible label: innings, score at 10 overs, TV projection, know-nothing guess, actual total, TV's average miss, agent's prediction unknown; `null` if example is null |
