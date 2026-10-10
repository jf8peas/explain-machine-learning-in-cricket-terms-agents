# Data Model: Stages Panel Copy

No stored data. The structure response changes only in these values:

- `stages[4].name`: "Choose the candidate model" (id `choose`, number 5, question unchanged).
- `notes.stages`: a key for each of the eight stage ids, each a plain string (the agreed text with five numbers interpolated).
- `notes.general`: one sentence, or the key is absent when the data cannot be read.

Rules: every stage id has exactly one note; notes are plain text (no markup); the numbers equal `SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP`, `MARGIN_RUNS` and `len(GRID)`; the years equal those of `rolling_checks()`.
