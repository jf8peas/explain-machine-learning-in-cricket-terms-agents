# Data Model: A Visual "In Cricket Terms"

## Facts

Each fact: `id`, `value` (number or string), `unit`, `display` (the exact text substituted into wording), `meaning` (the plain description given to the model). Runs are shown to one decimal, shares as whole percentages, years as years, as the page already rounds them.

| Id | Meaning | Unit | Source (existing calculation) |
|---|---|---|---|
| `goal_reached` | whether the winner beat the TV projection by at least the goal margin | yes/no | `final.cleared_margin` / `goal.py` |
| `beat_tv` | whether the winner beat the TV projection at all | yes/no | `final.beat_tv` |
| `beat_tv_by` | runs by which the winner beat (or missed) the TV projection, as a positive number | runs | `final.improvement` |
| `goal_margin` | the margin the goal asked for | runs | `goal.goal()["margin_runs"]` (`MARGIN_RUNS`) |
| `short_of_goal_by` | how far short of the goal the winner finished (only if beat but missed) | runs | goal margin minus improvement |
| `beat_know_nothing_by` | runs by which the winner beat the know-nothing guess | runs | `final.accuracy` / reference figures (feature 006) |
| `share_within_10` | share of test innings the winner predicted within the threshold | percent | `final.accuracy` (one decimal, as the table shows it) |
| `within_runs_threshold` | the number of runs that share is measured at | runs | `final.tolerances` |
| `winner_name` | which method won | text | `final.winner_name` |
| `winner_test_miss` | the winner's average miss on the test year | runs | `final.winner_mae` |
| `tv_test_miss` | the TV projection's average miss on the test year | runs | `final.test_mae.tv` |
| `winner_validation_error` | the winner's average miss over the check years | runs | `final.validation_mae[winner]` |
| `effect_<feature>` (one per feature in the winning model) | runs a typical difference in that feature moves the predicted total (signed) | runs | `coefficient × feature_iqr` |
| `typical_difference_<feature>` | the typical difference used (the interquartile range) | the feature's unit | `feature_iqr` |
| `biggest_factor` | the feature with the biggest absolute effect | text | max of the above |
| `biggest_factor_effect` | its effect | runs | as above |
| `wicket_cost` | runs a wicket lost by the halfway mark costs by the end, absolute value | runs | `abs(coefficients["wickets_at_10"])` |
| `wicket_cost_direction` | `cost` or `gain` (a wicket did not cost runs) | text | sign of that coefficient |
| `wicket_in_hand_value` | runs a wicket in hand is worth (when the model has `wickets_in_hand` instead) | runs | `abs(coefficients["wickets_in_hand"])` |
| `check_year_1`, `check_year_2`, `check_year_3` | the three check years | years | `split.checks[*].year` |
| `test_year` | the test year | year | `split.test_year` |
| `training_from`, `training_to` | the first and last training years | years | `split` / rolling checks (feature 008) |
| `n_features` | number of features in the winning model | count | `len(features)` |

If the winning model has neither wicket feature, the wicket facts are absent and the wicket block is omitted.

## Blocks

| Id | Shows | Visual data | Default sentences |
|---|---|---|---|
| `verdict` | headline and the goal badge | `goal_reached`, `beat_tv`, margin figures | 1–2 (reached / beat but missed / did not beat variants) |
| `drivers` | what drives the final total | bar rows `{ feature, label, fact_id, effect_runs, display }`, biggest first | 1 |
| `wicket` | what a wicket costs (omitted when not applicable) | the fact id of the large figure and its direction | 1 |
| `how_chosen` | how it was chosen | year segments `{ kind, from, to }` for training, check and test years | 1 |
| `closing` | what the result means for a fan | none | 1 |

Order: `verdict` first and `closing` last always; `drivers`, `wicket` (if present) and `how_chosen` may be reordered by the model from the fixed list.

## State: `explanation`

`{ facts: {id: {value, unit, display, meaning}}, blocks: [{ id, title, sentences, visual }], order: [ids], source: "template" | "language model", model: str | null, fallback_reason: str | null }`.

## The model's reply

`{ "blocks": { "<id>": { "title": str, "sentences": [str] } }, "order": [ids of drivers, wicket, how_chosen], "closing_lead": "<fact id>" }`. Text may contain `{fact_id}` placeholders and no digit. Limits: title ≤ 40 characters, ≤ 2 sentences per block (1 for closing), each sentence ≤ 120 characters.

## Rules

- Every number in the section equals a fact's display value.
- The model's text is checked before it is used: no digit, only known placeholders, within limits.
- Placeholders are filled by the same function for templates and for model wording.
- Omitted wicket block: not in `blocks` and not in `order`.
