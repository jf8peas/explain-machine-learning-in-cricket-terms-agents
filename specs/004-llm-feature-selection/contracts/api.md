# Contracts: HTTP API changes

Builds on `specs/001-linear-regression-agent/contracts/api.md` and `specs/002-data-tab/contracts/data-api.md`.

## `GET /api/models` (new)

The owner's allowed models as the page may see them. Model ids and the key are never included.

```json
{ "models": [
    { "name": "Fast", "note": "Quick and cheap; a good first try", "default": true, "choice": "m1" },
    { "name": "Balanced", "note": "A little slower, usually careful with its reasons", "default": false, "choice": "m2" } ] }
```

`choice` is an opaque token (the position in the owner's list). The page sends it back as `model`; the server maps it to the real id. A value not in the list is refused.

Cache: `public, s-maxage=300`.

## `GET /api/catalogue` (new)

```json
{ "limit": 8,
  "features": [
    { "id": "wickets_at_10", "label": "wickets lost at the halfway mark", "description": "…", "unit": "wickets",
      "bounds": { "min": 0, "max": 9 }, "source": { "measured": true }, "inputs": ["wickets_at_10"] },
    { "id": "wickets_in_hand", "label": "wickets in hand", "description": "…", "unit": "wickets",
      "bounds": { "min": 1, "max": 10 }, "source": { "difference": { "from": 10, "of": "wickets_at_10" } },
      "inputs": ["wickets_at_10"] } ] }
```

Used by the page to show the catalogue and to build the try-your-own form. Cache: `public, s-maxage=3600`.

## `GET /api/run?model=<choice>` (changed)

Order of checks, all before any model call: model, then concurrent-run lock, then hourly limit, then daily cap. On success the response is the existing Server-Sent Events stream.

**Refusals** (JSON, no stream, no model call):

| Status | `reason` | When |
|---|---|---|
| 400 | `model_not_allowed` | `model` missing is treated as the default; a value not in the list is refused |
| 429 | `run_in_progress` | the same visitor already has a run going |
| 429 | `hourly_limit` | the visitor's hourly limit is reached |
| 429 | `daily_limit` | the site's daily cap is reached |

```json
{ "reason": "hourly_limit", "message": "You can start another run in 12 minutes.", "retry_after_seconds": 720 }
```

A `Retry-After` header carries the same seconds. If the limit store cannot be reached the run starts, with `llm_status: "not_used"` and no model call.

If the chosen model's host fails during the run, see the step events below; the response is still a normal stream.

**Events** (unchanged envelope `step`, then `done` or `error`): each `step` has `step`, `node`, `summary`, `changes`. New nodes and their `changes`:

| node | actor | changes |
|---|---|---|
| `load_data` | code | `data_summary`, `model_name` |
| `split` | code | `split` |
| `explore` | code | `explore` (training years only) |
| `baseline` | code | `baseline_validation_mae` |
| `propose_features` | llm | `proposal` `{features, reason, finished}`, `rounds_used`; or `llm_status: "failed"` and `llm_failure` |
| `check_proposal` | code | `decision` (`fit`, `rejected`, `finished`, `failed`), `rejections` on a rejection |
| `fit_model` | code | `features`, `coefficients`, `intercept` |
| `evaluate` | code | `attempts` (accumulated), `llm_best`, `decision` (`continue` or `stop`) |
| `forward_selection` | code | `attempts` (accumulated), `forward_best`, `decision` |
| `final_test` | code | `final` `{test_mae: {llm, forward, tv}, winner, margin, beat_tv}`, the winner's `features`, `coefficients`, `intercept` |
| `explain_in_cricket_terms` | code | `explanation` |

Every number in these events is computed by code. The model's `reason` is the only free text from the model and is sent verbatim.

## `GET /api/structure` (changed)

Each node gains `actor` (`"llm"` or `"code"`; start and end nodes have none). Edges and the `branch` labels follow the new graph (`fit`, `rejected`, `finished`, `failed`, `continue`, `stop`, plus the forward-selection self-loop). The schema `contracts/structure.schema.json` is updated to allow `actor`.

## `GET /api/data` (changed)

Columns: the 16 candidates (those that are not derived are the measured ones), each with the catalogue's label and description; `used_for` values become `training`, `validation`, `test` with labels Training, Validation, Test. Summary counts report all three slices. Notes: the "What are dummy variables?" note stays.

## Secrets

Nothing in `/api/models`, `/api/catalogue`, `/api/run`, `/api/data`, `/api/structure` or any error body contains the OpenRouter key, the Upstash token, the model ids or the visitor's address. A test searches every response and event for a recognisable key.
