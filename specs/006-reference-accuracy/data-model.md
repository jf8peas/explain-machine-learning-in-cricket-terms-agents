# Data Model: How Good Is the Reference?

Nothing is stored. These are the shapes the code works with, the new run-state keys, and the response of the new endpoint. Wire detail for the endpoint is in `contracts/api.md`.

## Method (defined once, `backend/linreg/methods.py`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `know_nothing`, `broadcaster`, `llm`, `forward` |
| `name` | string | display name used everywhere: "the know-nothing guess", "the TV projection", "the language model's model", "forward selection's model" |
| `note` | string | one line of technical description, shown in the table and the key |
| `marker` | string | `square`, `circle`, `triangle`, `diamond` (open shapes) |

The order of the tuple is the display order. `test_mae` in the final state keeps its old keys (`llm`, `forward`, `tv`); `tv` is the `broadcaster` method.

## Accuracy figures (`backend/linreg/accuracy.py`)

Returned by `accuracy(actual, predicted)` unrounded and by `display(figures)` rounded for storage:

| Field | Stored form | Meaning |
|---|---|---|
| `n` | integer | innings scored |
| `average_miss` | runs, 1 decimal | mean of absolute error |
| `within_10`, `within_20` | percent, 1 decimal | share of innings within 10 / 20 runs (inclusive) |
| `miss_percent` | percent, 1 decimal | `average_miss` ÷ mean actual total × 100 |
| `bias` | runs, 1 decimal, signed | mean of predicted − actual; positive means too high |

Constants in the same module: `TOLERANCES = (10, 20)` and `LARGE_BIAS_SHARE = 0.5`. A method has a **large bias** when `|bias| ≥ LARGE_BIAS_SHARE × average_miss`.

## Goal and verdict (`backend/linreg/goal.py`)

| Goal field | Value |
|---|---|
| `reference` | `broadcaster` |
| `margin_runs` | `MARGIN_RUNS` (3) |
| `text` | the one wording used by the introduction, the verdict and the explanation |

| Verdict field | Meaning |
|---|---|
| `reference_miss`, `winner_miss` | the two displayed average misses it is worked out from |
| `improvement_runs` | `reference_miss − winner_miss`, 1 decimal |
| `improvement_percent` | `improvement_runs ÷ reference_miss × 100`, 1 decimal |
| `beat` | `improvement_runs > 0` |
| `reached` | `improvement_runs ≥ margin_runs` |
| `winner` | `llm` or `forward` |

`CLEARLY_BETTER_SHARE = 0.10`: the projection is clearly better than the know-nothing guess when its average miss is at least 10% lower (`finding`: `clearly_better`, `slightly_better` or `no_better`).

## New run-state keys

| Key | Set by | Contents |
|---|---|---|
| `reference_validation` | `baseline` | `{know_nothing: figures, broadcaster: figures}` on the validation year |
| `final.accuracy` | `final_test` | `{method id: figures}` on the test year, for the methods present |
| `final.methods` | `final_test` | the ids present, in display order (three when the language model did not take part) |
| `final.identical` | `final_test` | pairs of method ids whose predictions are identical, for example `[["llm", "forward"]]` |
| `final.bias_finding` | `final_test` | `{same_direction_large: bool, direction: "low" \| "high" \| null}`, judged over the projection and the agent's models only (not the know-nothing guess) |
| `final.method_defs` | `final_test` | the definitions (`id`, `name`, `note`, `marker`) of the methods present, so the page needs nothing else to name them |
| `final.reference_finding` | `final_test` | `{finding, gap_runs, gap_percent, sentence}`: whether the projection was clearly, only slightly, or not better than the know-nothing guess on the test year |
| `final.verdict` | `final_test` | the verdict above |
| `final.verdict_sentence` | `final_test` | the verdict in words (the goal's wording) |
| `final.versus_know_nothing` | `final_test` | `{reference_miss, winner_miss, improvement_runs, improvement_percent, beat}` for the winner against the know-nothing guess |
| `final.bias_words`, `final.bias_sentence` | `final_test` | the bias of each method in words; the same-direction finding in words (or null) |
| `final.tolerances` | `final_test` | `[10, 20]`, the tolerances the hit rates use |
| `chart_points` | `final_test` | `{actual: number[], predicted: {method id: number[]}}`, one value per test innings, rounded to 1 decimal (transport only) |

`final.beat_tv`, `final.cleared_margin` and `final.improvement` keep their names and now take their values from `final.verdict`.

## Reference response (`GET /api/reference`)

`goal`, `methods` (all four definitions), `training` (`first_year`, `last_year`, `innings`), `figures` (`know_nothing` and `broadcaster`, or `null`), `gap` (the know-nothing guess minus the projection: average miss in runs and percent, hit rate within 10 runs in points), `finding`, `sentences` (`headline`, `gap`, `finding`, `bias`: plain text built by code) and `message` (null, or why the figures are missing).

## Chart selection (page state only)

The set of method ids the chart shows. Default: the winner plus `broadcaster`. Held by the page, not in the run state, not sent anywhere.
