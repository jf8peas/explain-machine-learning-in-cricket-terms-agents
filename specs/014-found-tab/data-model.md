# Data Model: "What the agent found" Tab

Nothing is stored or calculated anew. The tab is a view of the run state at the step on display and of `/api/catalogue`.

## Inputs

| Input | Field | Used for |
|---|---|---|
| Catalogue | `round_cap`, `grid_combinations` (new); `setup_menus.*[].label` and `.short` (short is new); `features[].label` | Section 1 counts; setup wording; grid headings |
| Split | `split.first_year`, `split.checks[].year`, `split.test_year` | Season strip |
| Rounds | `rounds[]`: `round`, `features`, `window`, `weighting`, `training_innings`, `reason`, `finished`, `outcome` (`fit`, `rejected`, `finished`, `failed`), `message` | Round cards, chart marks |
| Attempts | `attempts[]`: `features`, `proposer`, setup parts, `validation_mae`, `improved`, `round` | Scores, best-so-far, ranking |
| Grid | `grid.cells[]` (`training_innings`, `window`, `weighting`, `allowed`, `note`, `features`, `validation_mae`), `grid.best`, `grid.build_up` | Grids, rival line, ranking |
| Bests | `llm_best`, `forward_best` | Winner panel, chart lines |
| Winner | `validation_winner` (`winner` is `llm` or `forward`, `reason`) | Winner panel |
| TV | `baseline_validation_mae` | Chart line, ranking footer, winner panel |
| LLM | `llm_status` (`ok`, `failed`, `not_used`), `llm_failure`, `model_name` | AI card, fallback |

## Derived view (found/view.ts, pure)

- **RoundView**: round number; `kind` (`fitted`, `rejected`, `finished`, `failed`); features; setup parts; reason; message; for fitted rounds `miss` (displayed, one decimal), `improved`, `drop` (previous best minus this miss, from displayed values; absent for the first fitted round), `clueChange` (`same` or `added: [labels]`, from the previous fitted round's features); `isBest` (the round whose attempt is the AI's best).
- **BestSoFar**: points `(round, miss)` taken from improved LLM attempts only, as a step series.
- **Rival**: `{miss}` from `forward_best`; `null` until `grid` exists in the state shown.
- **Tv**: `{miss}` from `baseline_validation_mae`, or `null`.
- **Winner**: `pending` (no `validation_winner`) or `{side: "ai" | "rival", winnerMiss, otherMiss, gap, tie}` with gap from displayed values; with no LLM attempts, side is `rival`.
- **GridView**: one table per training-innings choice; cell `{text, allowed, note, rank step, best}`; best-cell sentence parts.
- **RankingRow**: `{rank, features, setup parts, foundBy: "AI agent" | "Rival", miss}`.

## Rules

- A round's score comes from the LLM attempt with the same round number; the `forward_selection` attempt is never joined to a round.
- Ranking lists LLM attempts and every allowed grid cell; the `forward_selection` attempt is omitted (it is the grid's best cell). Order: `validation_mae` ascending, ties LLM first then grid order.
- All misses shown to one decimal; gap and drop come from those rounded values.
- No LLM attempts and status `not_used`, or `failed` with none: fallback layout.
- Winner wording follows the recorded `validation_winner`, never the rounded values. `tie` is true only when the displayed misses are equal and the recorded winner is `llm`. If they are equal but the winner is `forward`, side is `rival` with `gap` 0.0 and a flag `belowDisplay` (the panel says the gap is smaller than the display shows).
- A run with no fitted LLM attempts (not used, failed, or every round rejected, finished or failed) has no AI best line and the winner is the rival; it is the full fallback layout only when status is `not_used` or `failed`, otherwise round cards still show.
- The grid, the rival line and the rival's ranking rows arrive together at the `grid_search` step; they are not built up cell by cell.
- Before `grid_search` is on display: no rival line, no grids, no rival rows, winner panel says the search is still going.
