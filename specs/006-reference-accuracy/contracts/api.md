# Contracts: HTTP API and run-state changes

Builds on `specs/004-llm-feature-selection/contracts/api.md` and `specs/005-ml-stages/contracts/structure.md`. Nothing existing changes shape; the new fields are additions.

## `GET /api/reference` (new)

The introduction's figures: the goal, the four method definitions, and how the know-nothing guess and the broadcaster's projection did on the **training years only**.

```json
{
  "goal": {
    "reference": "broadcaster",
    "margin_runs": 3,
    "text": "beat the TV projection by at least 3 runs of average miss, on the latest calendar year, which nothing was trained or chosen on."
  },
  "methods": [
    { "id": "know_nothing", "name": "the know-nothing guess", "note": "always the training years' average final total", "marker": "square" },
    { "id": "broadcaster", "name": "the TV projection", "note": "the broadcaster's projected score: current run rate x 20 overs", "marker": "circle" },
    { "id": "llm", "name": "the language model's model", "note": "a straight line on the features the language model picked", "marker": "triangle" },
    { "id": "forward", "name": "forward selection's model", "note": "a straight line on the features forward selection picked", "marker": "diamond" }
  ],
  "training": { "first_year": 2005, "last_year": 2024, "innings": 4036 },
  "figures": {
    "know_nothing": { "n": 4036, "average_miss": 29.4, "within_10": 22.8, "within_20": 43.1, "miss_percent": 18.9, "bias": 0.0 },
    "broadcaster":  { "n": 4036, "average_miss": 21.8, "within_10": 29.4, "within_20": 55.3, "miss_percent": 14.1, "bias": -12.1 }
  },
  "gap": { "average_miss_runs": 7.6, "average_miss_percent": 25.7, "within_10_points": 6.6 },
  "finding": "clearly_better",
  "words": {
    "know_nothing": { "bias": "leans neither way on average (0.0 runs)", "bias_short": "0.0" },
    "broadcaster":  { "bias": "guesses 12.1 runs too low", "bias_short": "12.1 too low" }
  },
  "sentences": {
    "headline": "…", "gap": "…", "finding": "…", "bias": "…"
  },
  "message": null
}
```

(The numbers above are the real training-year figures at the time of planning; the endpoint works them out from the data.)

| Rule | Detail |
|---|---|
| Training only | The response is worked out from the training slice of the three-way split. Changing every validation and test value changes nothing in it |
| Rounding | Figures are already rounded to one decimal (runs, percentages); `n` is an integer |
| `finding` | `clearly_better` (the projection's average miss is at least 10% below the know-nothing guess's), `slightly_better`, or `no_better`; `null` when `figures` is `null` |
| `sentences` | Plain text built by code from the figures; the page inserts it as text and types no number of its own |
| `words` | The bias of each reference in words, in full and in the short form a table cell uses; also built by code |
| Failure | If the data cannot be read the response is still `200` with `goal` and `methods`, `figures`, `gap`, `finding`, `sentences` and `training` all `null`, and `message` saying the figures could not be loaded |
| Cache | `public, s-maxage=3600, stale-while-revalidate=86400`, the same as `/api/data` (added to `vercel.json`) |

## The final test's additions to the run state

Sent in the existing `final_test` step event (the stream is otherwise unchanged).

```json
{
  "final": {
    "accuracy": { "know_nothing": {"…": "…"}, "broadcaster": {"…": "…"}, "llm": {"…": "…"}, "forward": {"…": "…"} },
    "methods": ["know_nothing", "broadcaster", "llm", "forward"],
    "identical": [],
    "bias_finding": { "same_direction_large": false, "direction": null },
    "method_defs": [ { "id": "know_nothing", "name": "the know-nothing guess", "note": "…", "marker": "square" }, "…" ],
    "reference_finding": { "finding": "clearly_better", "gap_runs": 7.1, "gap_percent": 25.4, "sentence": "…" },
    "verdict": {
      "reference_miss": 20.9, "winner_miss": 18.9, "improvement_runs": 2.0, "improvement_percent": 9.6,
      "beat": true, "reached": false, "winner": "forward"
    }
  },
  "chart_points": { "actual": [ 143.0, 171.0, "…" ], "predicted": { "know_nothing": ["…"], "broadcaster": ["…"], "llm": ["…"], "forward": ["…"] } }
}
```

| Rule | Detail |
|---|---|
| Each method is scored once | On the test year, in `final_test` only |
| Fallback | If the language model did not take part, `llm` is missing from `methods`, `method_defs`, `accuracy` and `chart_points.predicted` |
| `bias_finding` | Judged over the TV projection and the agent's models only; the know-nothing guess's bias is near zero by construction |
| `reference_finding` | The same clearly / only slightly / no better rule as the introduction's, applied to the test-year figures |
| Identical predictions | Both methods stay in; the pair is listed in `identical` |
| `verdict` | Worked out from the rounded figures in `accuracy`, so the page can be checked by hand; `winner` is decided as before on unrounded test errors |
| Extra keys in `final` | `bias_words` (per method), `bias_sentence` (the same-direction finding in words, or null), `verdict_sentence`, `versus_know_nothing` (the winner against the know-nothing guess: runs, percent, beat) and `tolerances` (`[10, 20]`), so every number in the page's sentences is a figure in the state |
| `chart_points` | A top-level key (not inside `final`) so the state panel can summarise it; values rounded to one decimal for transport only, while the figures use the unrounded predictions |

## `baseline` step

Adds `reference_validation` (`{know_nothing, broadcaster}` figures on the validation year) and a sentence to its summary. It reads no test-year data.

## `vercel.json`

A header block for `/api/reference` with the same `Cache-Control` as `/api/data`.
