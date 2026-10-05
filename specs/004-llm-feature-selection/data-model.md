# Data Model: LLM-Driven Feature Selection

## Feature catalogue (`backend/linreg/features.py`, served by `GET /api/catalogue`)

One entry per candidate:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Column name in `innings.csv`; exact-match key (case-sensitive) for proposals |
| `label` | string | Cricket wording, for example "wickets lost in the powerplay" |
| `description` | string | One or two plain sentences, shown to the visitor and given to the language model |
| `unit` | string | "runs", "wickets", "balls", "count", "0/1" |
| `bounds` | `{min, max?}` | Valid range for the try-your-own form (for example wickets 0 to 9) |
| `source` | object | `{"measured": true}` or a recipe |
| `inputs` (derived, served) | string[] | The measured columns a recipe depends on, found by following recipes |

**Recipes** (data, interpreted by `recipes.py` and `recipes.ts`):

- `{"difference": {"from": 10, "of": "wickets_at_10"}}`: `from - of`
- `{"product": ["runs_at_10", "wickets_in_hand"]}`: product of two columns (which may be derived)
- `{"indicator": {"column": "competition", "equals": "ipl"}}`: 1 if equal, else 0 (the dummies; built from `competition_dummies.DUMMIES`)

**The 16 candidates**: `runs_at_10`, `wickets_at_10`, `powerplay_runs`, `powerplay_wickets`, `runs_overs_7_10`, `wickets_overs_7_10`, `fours_at_10`, `sixes_at_10`, `dot_balls_at_10`, `extras_at_10`, `partnership_runs`, `balls_since_last_wicket` (measured, 12); `wickets_in_hand`, `runs_x_wickets_in_hand` (derived); `is_ipl`, `is_bbl` (derived, feature 003). Definitions in research.md, Decision 7. `final_total` is the target and is not a candidate.

**Rules**: every id is a column of the prepared table; a recipe only reads earlier catalogue entries or `competition`; nothing reads past the end of over 10.

## Prepared table (`data/innings.csv`)

Columns, in order: `match_id, match_date, season, competition, is_ipl, is_bbl, venue,` then the other candidates in catalogue order, then `final_total`. All candidate values are integers. The manifest gains `features`: for each candidate column, `{"measured": true}` or its recipe, so the file describes itself.

## Slices

| Slice | Which innings | Used for |
|---|---|---|
| Training | calendar years before the validation year | fitting every model |
| Validation | the second most recent calendar year | choosing feature sets (the language model's and forward selection's) |
| Test | the most recent calendar year | `final_test` only |

`Slices` carries the three frames and the two years. The check "at least 100 innings" applies to validation and to test; with fewer, `load_data` stops with a data error.

## Run state (what the stream carries; never the key, never credentials)

| Key | Meaning |
|---|---|
| `model_name` | The friendly name of the chosen model (the id stays in the run config) |
| `llm_status` | `"ok"`, `"failed"` (with `llm_failure`: a short plain reason) or `"not_used"` (limit store unreachable) |
| `split` | years and counts for the three slices |
| `explore` | training-only statistics (per-candidate correlation with the total; means by wickets lost and competition) |
| `baseline_validation_mae` | the TV projection's validation error |
| `rounds` | accumulating list, one entry per round: `{round, features, reason (verbatim), outcome}` where `outcome` is `fit`, `rejected` (with the reason), `finished` or `failed`; the leaderboard's rounds list is built from it |
| `proposal` | the latest proposal: `features`, `reason` (verbatim), `finished` |
| `rejections` | list of `{round, features, reason}` |
| `attempts` | list of Attempt (below), appended by `evaluate` and `forward_selection` |
| `rounds_used` | rounds taken, including rejections (cap 6) |
| `llm_best`, `forward_best` | the best Attempt from each proposer |
| `final` | `{test_mae: {llm, forward, tv}, winner, margin, beat_tv}` from `final_test` |
| `features`, `coefficients`, `intercept`, `feature_iqr` | the fitted model currently in focus; at the end, the winner's |
| `explanation` | sentences and comparison numbers built by code |
| `decision`, `summary`, `data_error`, `data_summary` | as before |

## Attempt

| Field | Type | Meaning |
|---|---|---|
| `features` | string[] | The set that was fitted |
| `proposer` | `"llm"` or `"forward_selection"` | Who proposed it |
| `validation_mae`, `validation_r2` | number | Computed by code on the validation year |
| `improved` | boolean | Lower validation error than the best so far for this proposer |
| `round` | integer | Round number for the language model; step number for forward selection |

## Proposal check outcomes

`fit`, `rejected` (with `reason`: `unknown_feature`, `empty`, `too_many`, `already_tried`, `redundant`, each with plain text and the features involved), `finished`, `failed`.

## Model option (owner configuration)

`{ "id": "openai/gpt-6-luna", "name": "Fast", "note": "Quick and cheap; a good first try", "default": true }`. Exactly one default. The public view (`GET /api/models`) omits the id.

## Run limits (environment variables, with the spec's defaults)

`VISITOR_ID_SECRET` (a server secret used to hash visitor addresses; if unset a random per-process value is used, which does not survive restarts), `RUN_LIMIT_PER_HOUR` (5), `RUN_LIMIT_PER_DAY` (300), `RUN_LOCK_SECONDS` (90, equal to `maxDuration`), `LLM_MAX_TOKENS` (800), `LLM_MAX_CALLS` (round cap plus 2 = 8), `LLM_CALL_TIMEOUT` (25), `RUN_DEADLINE_SECONDS` (80).

## Validation rules

- A proposal is only acted on after `check_proposal` passes; nothing from a model reply is ever put into a number shown to the visitor.
- The catalogue, the CSV columns and the manifest `features` entry agree (a test).
- Derived columns in the CSV equal their recipes on every row (checked on load).
