# Data Model: A Lighter Goal Section

Nothing is stored. One new object travels in `GET /api/reference`, one field is added to the goal, and the page derives a few values from them. Wire detail is in `contracts/api.md`.

## Goal (existing, one field added)

| Field | Notes |
|---|---|
| `reference`, `margin_runs`, `text` | Unchanged (feature 006) |
| `lead` | New. The page's one lead sentence, with the margin from the same constant: "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by 3 runs less on average." Needs no figures |

## Meter (new, `GET /api/reference`)

| Field | Type | Notes |
|---|---|---|
| `scale` | `{min, max}` | Whole runs, `min < max`. `min = floor(low − P)`, `max = ceil(high + P)`, where `low` and `high` are the smallest and largest of the three values and `P = max(3, ceil(0.2 × (high − low)))` |
| `marks` | list of three | In the order know-nothing, TV projection, goal |
| `marks[].id` | string | `know_nothing`, `broadcaster`, `goal` |
| `marks[].label` | string | "Know-nothing guess", "TV projection", "The goal" (the first two derived from the method names in `methods.py`) |
| `marks[].value` | number, 1 decimal | The two average misses on the training years; the goal is the TV projection's displayed miss minus `margin_runs`, to one decimal |
| `caption` | string | "Average miss, runs · 2005 to 2024, 4,036 innings" |
| `text` | string | The text equivalent: "Average miss, lower is better: the know-nothing guess 29.4, the TV projection 21.8, the goal 18.8 or less." |

Rules: the goal mark's value is stored once (here); every value is already rounded to one decimal; the scale contains every value with room on both sides, in any order of the three; a goal at or below zero is allowed and extends the scale below zero. `meter` is `null` whenever `figures` is.

## Derived on the page

| Value | Definition |
|---|---|
| Position of a mark | `(value − scale.min) / (scale.max − scale.min) × 100`, rounded to one decimal, kept between 0 and 100 |
| Goal zone width | The goal mark's position (the zone runs from the left end of the line to the goal) |
| Layout rows | For each mark, which vertical row its label and value use, so close marks do not overlap (Decision 5 in `research.md`); three attributes per mark: `data-row-wide`, `data-row-narrow`, `data-side-narrow` |

## Page state

Nothing new: the two closed sections start closed on every load and are not remembered.
