# Data Model: Consistent Terminology

All of it lives in `backend/linreg/methods.py` and reaches the page through `GET /api/reference`.

## Term

| Field | Type | Meaning |
|---|---|---|
| `id` | string | stable key: `agent`, `brute_force`, `tv`, `average_total`, `idea`, `clues`, `settings`, `check_seasons`, `test_season`, `pick` |
| `plain` | string | the Scoreboard word, used at every level: "AI agent", "brute-force search", "TV projection", "average-total guess", "idea", "clues", "settings", "check seasons", "test season", "our pick" |
| `technical` | string | the bracketed term: "language-model agent", "grid search with forward selection", "run rate × 20 overs", "baseline (the training seasons' average total)", "candidate model", "features", "hyperparameters", "validation (rolling cross-validation)", "hold-out test", "the model chosen on the check seasons" |
| `meaning` | string | one line, at most 14 words, plain style, no banned term; shown in "Words we use" and fed to nothing else |
| `order` | int | display order; the list is always served sorted by it |
| `alt_plain` | string or null | accepted second plain form (`test_season` has "final test") |

Rules: `plain` is unique; no `plain`, `alt_plain` or `meaning` contains a banned pattern; `technical` may contain "forward selection" (allowed in brackets); every `id` used in backend wording exists (a test greps `term("…")` calls against the list).

Helpers (backend): `term(id) -> str` (plain), `with_technical(id) -> "plain (technical)"`, `meaning(id)`, `terms_payload()`.

## Method

The existing `Method` (id, name, note, marker) stays, with `name` now read from the term list: `know_nothing` → term `average_total`; `broadcaster` → `tv`; `llm` → `agent`; `forward` → `brute_force`. `name` becomes the possessive form where the page needs a model ("the AI agent's idea"). Method ids and `marker` shapes are unchanged (internal identifiers, FR-007), so charts, state keys and tests keep working.

`cricket_facts.METHOD_LABELS` becomes a derived dict `{method_id: term(...)}`; it is no longer typed.

## Banned pattern

| Field | Meaning |
|---|---|
| `pattern` | case-insensitive whole-word regex: `rival`, `know-nothing`, `mechanical search`, `forward selection`, `setup` |
| `allowed_in` | regions where it is permitted: `[]` for the first three and `setup`; `["commentary", "scorebook", "definition"]` for `forward selection` (in `commentary` and `scorebook` only inside brackets after a plain term; anywhere in `definition`); every pattern is also permitted in `reasoning` |

Served as `banned`. The "setup" allowlist (approved phrases) is not part of the payload: it lives next to the Playwright check (`web/tests/e2e/banned-terms.allow.ts`), as the brief requires.

## Definitions

A small map `definitions` in `methods.py`, served beside `terms`:

| Key | Content |
|---|---|
| `brute_force` | the exact one-sentence Scoreboard definition (spec, User Story 2) |
| `brute_force_technical` | the Commentary paragraph: grid search over `{grid_combinations}` combinations of three hyperparameters (which innings, how many seasons, how much recent seasons count), greedy forward selection of features in each cell |
| `brute_force_honest` | the note: "brute-force" refers to the settings; it does not try every possible set of clues (2^`{n_clues}`, about `{subsets}`) |

`grid_combinations` comes from `setup_settings.grid_combinations()`; `n_clues` and `subsets` from the feature catalogue (19 and 524,288, formatted "about 524,000"), computed, not typed.

## Wording version

`terms_version` = short hash of (terms, definitions, wording-function outputs on a fixed fixture). `recorded-run.json` stores `wording_version`; the wording test fails when the file's value differs from the code's or when any code-worded string differs from a fresh rebuild.

## Response shape (`/api/reference` additions)

```json
{
  "terms": [{"id": "agent", "plain": "AI agent", "technical": "language-model agent", "meaning": "…", "order": 1, "alt_plain": null}],
  "definitions": {"brute_force": "…", "brute_force_technical": "…", "brute_force_honest": "…"},
  "banned": [{"pattern": "forward selection", "allowed_in": ["commentary", "scorebook", "definition"]}],
  "terms_version": "w1-3f9a…"
}
```

`methods` keeps its 020 shape. All four new fields are sent on the `NOT_LOADED` failure path too.
