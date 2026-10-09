# Contracts: changes since feature 007

A diff against `specs/007-goal-section-redesign/contracts/api.md` and `specs/006-reference-accuracy/contracts/api.md`. Everything not listed is unchanged.

## `GET /api/structure`

- The node `forward_selection` is replaced by `grid_search` (actor `code`, stage `choose`). Its self-loop edge (`forward_selection` to `forward_selection`, branch `again`) is gone; the edges are `check_proposal` (branch `finished`) and `evaluate` (branch `stop`) into `grid_search`, and `grid_search` to `final_test` (unconditional). The edge count the structure test expects changes with it.
- `notes.stages.choose`: the old "feature selection only … later apps" text is replaced by the hyperparameter explanation (research.md Decision 15). `notes.stages.split` is new: it describes the three checks.
- `notes.general` (the loop note) names the three check years and the test year, from `rolling_checks`; without readable data it names no year.
- The done-beforehand item's rows gain the new columns' count.

## `GET /api/catalogue`

- `features` gains two entries: `batting_full_member` and `both_full_members` (id, label, unit `0/1`, bounds 0 to 1, description). The entry for `both_full_members` says it equals "neither IPL nor BBL" inside the test population.
- New `setup_menus`:

```json
"setup_menus": {
  "window": [{"id": "all", "label": "all available years"}, {"id": "last_10", "label": "the last 10 seasons"},
             {"id": "last_5", "label": "the last 5 seasons"}, {"id": "last_3", "label": "the last 3 seasons"}],
  "weighting": [{"id": "none", "label": "every season counting equally"},
                {"id": "gentle", "label": "recent seasons counting a little more"},
                {"id": "strong", "label": "recent seasons counting much more"}],
  "training_innings": [{"id": "population", "label": "full-member and league innings only"},
                       {"id": "all", "label": "all innings, including associate nations"}]
}
```

(Labels are indicative; the module is the source.) The page reads every menu label from here.

## `GET /api/data`

- `columns` gains `batting_team`, `bowling_team` (text), `batting_full_member`, `bowling_full_member`, `in_test_population` (0/1, filter `select`), each with a description. The CSV downloads carry them.
- `used_for` values are `training`, `training_validation`, `test`, with labels "Training", "Training and validation", "Test" and a description of the rolling checks. The old `validation` value no longer exists.
- `summary`: the "Slices, by calendar year" section is replaced by "How the years are used": "Training (first year to the year before the first check)", "Training and validation (three check years)", "Test (the test year)", each with the number of test-population innings; a new "Test population" section gives the innings in and out of it and per competition.

## `GET /api/reference`

- The figures (`figures`, `gap`, `finding`, `words`, `sentences`, `meter`) are worked out on **test-population innings in the years before the first check year** (test year − 3), not on the old training years. `training` keeps its shape (`first_year`, `last_year`, `innings`) for those innings. The know-nothing guess is the mean of those innings. Everything else (goal, lead, methods, failure shape) is unchanged.
- Changing the check years' or the test year's values changes nothing in the response.

## `GET /api/run` (server-sent events)

State keys changed or added (each `step` event's `state` carries the full accumulated state as before):

| Key | Change |
|---|---|
| `split` | `{test_year, checks: [{year, n, earlier_years: [first, last]}], test_n}`; the old `train_n`, `validation_*` keys are gone |
| `explore` | Statistics from test-population innings before the test year, plus `mean_total_by_year` and `innings_by_competition_year` |
| `baseline_validation_mae` | The TV projection's mean error over the three checks |
| `reference_validation` | `{know_nothing, broadcaster}` each the displayed accuracy figures averaged over the three checks, plus `by_check: [{year, know_nothing, broadcaster}]` |
| `proposal` | `{features, window, weighting, training_innings, reason, finished}`; a missing part is `null` |
| `rounds[]` | Each note gains the three setup parts and, for a rejected proposal, `code` among `missing_part`, `unknown_window`, `unknown_weighting`, `unknown_training_innings`, `unknown_feature`, `empty`, `too_many`, `already_tried`, `too_few_innings`, `redundant` |
| `attempts[]`, `llm_best`, `forward_best` | Each gains `window`, `weighting`, `training_innings` and `checks: [{year, mae}]`; `validation_mae` is the mean of the three |
| `grid` | New, at the `grid_search` step: `{caption, cells: [...24], best, build_up}` as in data-model.md |
| `validation_winner` | New: `{winner: "llm" or "forward", reason}`, set at the `grid_search` step |
| `final` | `test_mae` and the verdict are on the test-population innings; `sets` carries each model's full setup; `winner_chosen_on: "validation"`; `llm_took_part` as before |
| `explanation.sentences` | Includes the winning setup in cricket language |

Event order: `load_data`, `split`, `explore`, `baseline`, then the model loop (`propose_features`, `check_proposal`, `fit_model`, `evaluate`), then one `grid_search`, `final_test`, `explain_in_cricket_terms`. A run ends at `load_data` with `data_error` when a check year, the test year or the earlier years are too thin.

## The language model's reply

```json
{"features": ["runs_at_10", "wickets_in_hand"], "window": "last_5", "weighting": "gentle",
 "training_innings": "population", "reason": "…", "finished": false}
```

All four setup parts are required by the schema; the parser accepts a reply that omits one so `check_proposal` can reject it with its own reason.

## The preparation script and files

- `scripts/prepare_data.py` writes the five new columns and the four manifest entries, prints every non-member T20I team name with its innings count and warns about any full member never seen. `--from-existing` fails with the existing "cannot be worked out from the file" message listing the team columns.
- `data/manifest.json`: `full_members`, `team_aliases`, `absent_full_members`, `population` (data-model.md).

## Nothing else changes

`/api/models`, the run limits and gate, `/api/structure`'s stage set, and the endpoints' cache headers.
