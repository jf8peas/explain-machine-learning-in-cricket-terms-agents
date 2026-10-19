# Research: "What the agent found" Tab Redesign

No open unknowns remained in the Technical Context; the decisions below record what the existing code showed.

## Where the data lives

- **Decision**: Read everything from the run state at the step on display, plus `/api/catalogue` for the round cap, combination count and labels.
- **Rationale**: `state.py` already carries `split` (`first_year`, `checks[].year`, `test_year`), `rounds` (with `outcome`, `message`, `reason`), `attempts` (with `round`, `improved`, `proposer`), `grid` (cells with `allowed`, `note`, `features`, `validation_mae`; `best`; `build_up`), `llm_best`, `forward_best`, `validation_winner` (set in `grid_search`, before the final test), `baseline_validation_mae`, `llm_status`, `llm_failure`.
- **Alternatives**: a new state field for the tab (rejected: duplicates data and changes the run).

## Round cap and combination count

- **Decision**: Add `round_cap` and `grid_combinations` to the `/api/catalogue` body.
- **Rationale**: The page already loads the catalogue for menu labels. `ROUND_CAP` lives in `state.py`; the grid is `len(WINDOWS) * len(WEIGHTINGS) * len(TRAINING_INNINGS)` (4 x 3 x 2 = 24 today), the same product `selection.GRID` enumerates. Computing it from the menus avoids importing `selection`.
- **Alternatives**: count the grid's cells from state (rejected: unavailable before `grid_search`, but section 1 must show the number from the start).

## Short labels

- **Decision**: `Option` in `setup_settings.py` gains a `short` field; `public_menus()` serves `{id, label, short}`.
- **Rationale**: Grid headings need compact text ("last 10", "a bit more"); keeping them beside the plain labels keeps one definition and nothing typed into the page.
- **Alternatives**: derive shortened text in the page (rejected: typed wording).

## Label spacing for the chart

- **Decision**: Import `spreadLabels` from `page/worm-layout.ts`.
- **Rationale**: Feature 013 is built and exports a pure, tested function with the needed behaviour (ordered, minimum gap, bounded).

## Theme tokens

- **Decision**: Use existing `--m-llm`, `--m-forward`, `--tv`, `--text`, `--muted`, `--border`, `--surface`.
- **Rationale**: `index.html` already defines `--tv` (light #a85600, dark #e8913a) and the method tokens for both themes. The README's reference hex values are for the picture; the page tokens win.

## Existing tests and test ids

- **Decision**: Keep `attempt-row`, `round-item`, `model-reason`, `setup-chip` where the element means the same thing (ranking rows, round cards, the reason quotation, the candidate model chips in cards). Remove the `check-error` ids with the column. Rewrite the old `grid.test.ts` for the new module.
- **Rationale**: Minimises changes to unrelated specs; the user asked that only tests of the old blocks change.

## Tie handling and the winner

- **Decision**: Present `validation_winner` as recorded; a tie is detected by equal displayed misses and worded with the existing rule (the AI's candidate model goes forward).
- **Rationale**: `selection.validation_winner` sends ties to the language model; the page must not re-decide.
