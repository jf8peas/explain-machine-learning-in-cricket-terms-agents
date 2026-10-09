# Contract: `GET /api/reference` (changes since feature 006)

This is a diff against `specs/006-reference-accuracy/contracts/api.md`. Everything not listed there is unchanged: `methods`, `training`, `figures`, `gap`, `finding`, `words`, `sentences`, the cache header, and the rules (training years only, computed once per process, a failure is not kept).

## Added

### `goal.lead`

```json
"goal": {
  "reference": "broadcaster",
  "margin_runs": 3,
  "text": "beat the TV projection by at least 3 runs of average miss, on the latest calendar year, which nothing was trained or chosen on.",
  "lead": "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by 3 runs less on average."
}
```

`lead` is built from the same margin as `text` and needs no figures, so it is present in every response, including when `figures` is `null`.

### `meter`

```json
"meter": {
  "scale": { "min": 15, "max": 33 },
  "marks": [
    { "id": "know_nothing", "label": "Know-nothing guess", "value": 29.4 },
    { "id": "broadcaster", "label": "TV projection", "value": 21.8 },
    { "id": "goal", "label": "The goal", "value": 18.8 }
  ],
  "caption": "Average miss, runs · 2005 to 2024, 4,036 innings",
  "text": "Average miss, lower is better: the know-nothing guess 29.4, the TV projection 21.8, the goal 18.8 or less."
}
```

(The numbers are the real training-year figures at the time of planning; the endpoint works them out.)

| Rule | Detail |
|---|---|
| The goal's value | `broadcaster.average_miss − goal.margin_runs`, to one decimal, from the displayed figures (the arithmetic `goal.verdict()` uses). It appears once, as the mark with id `goal` |
| The scale | Whole runs. With `low` and `high` the smallest and largest of the three values and `P = max(3, ceil(0.2 × (high − low)))`: `min = floor(low − P)` and `max = ceil(high + P)`. It holds for any order of the three values and for a goal at or below zero |
| `marks` | Always three, in this order. Labels come from the method names (`methods.py`) and the goal's own name, so no wording is typed in the page |
| `caption`, `text` | Plain text built by code from the same figures; the page inserts them as text. `text` is the meter's text equivalent |
| Failure | When the data cannot be read, `meter` is `null` along with `figures`, `gap`, `finding`, `words` and `sentences`; `goal` (with `lead`) and `methods` are still sent |

## Unchanged but now used differently

- `sentences.headline`, `sentences.gap` and `sentences.finding` still arrive, but the page shows them only inside the closed "Full figures for the two simple guesses" section.

## The `Reference` type in `web/src/page/reference.ts`

Gains `goal.lead: string` and `meter: { scale: {min: number; max: number}; marks: {id: string; label: string; value: number}[]; caption: string; text: string } | null`.

## Nothing else changes

`/api/structure`, `/api/run` and the run state, the results, `/api/data` and `/api/catalogue`.
