# Tasks: Stages Panel Copy for a Data Scientist

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/structure.md](contracts/structure.md)
**Prerequisites**: none beyond the repo (no `.specify` scripts or template exist; standard layout used by hand).
**Tests**: required by the spec (FR-008) and by the "all tests pass" acceptance, so test tasks are included.

All paths are under `apps/linear_regression/` unless stated. `B` = `backend/linreg/`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- US1 notes for all eight stages, US2 rename stage 5, US3 general note from the data, US4 numbers come from constants.

---

## Phase 1: Setup

- [x] T001 Run the backend pytest suite for `apps/linear_regression` and `cd web && npm run test`, and record a green baseline; list every hit for the old name with `grep -rn "Choose the setup"` over `B/`, `tests/`, `web/src`, `web/tests`, `README.md` (leave `specs/` as history), and every test that reads `notes.general`, `CHOOSE_NOTE`, `SPLIT_NOTE` or `loop_note`

---

## Phase 2: Foundational (blocks the stories)

- [x] T002 In `B/season_split.py` check whether a constant gives the number of checks; if not, define one (for example `CHECK_COUNT = 3`) and use it where `rolling_checks` builds the checks, without changing behaviour
- [x] T003 Confirm `B/selection.py` does not import `B/stage_info.py` (directly or through another module) so `stage_info.py` can import `selection.GRID`; if it would cycle, move the grid-size read behind a small function in `B/selection.py` or `B/setup_settings.py` that `stage_info.py` can import

**Checkpoint**: baseline green; the constants for all five numbers and the check count are importable from `stage_info.py`.

---

## Phase 3: User Story 2 - Rename stage 5 (P1)

**Goal**: stage 5 reads "Choose the candidate model" everywhere; id and question unchanged.
**Independent test**: `GET /api/structure` returns that name with id `choose` and the old question.

- [x] T004 [US2] In `B/stages.py` change the name of `Stage("choose", 5, ...)` to "Choose the candidate model" (keep id, question and description) and update the comment above `STAGES` if it names the old stage
- [x] T005 [P] [US2] Update `tests/test_stages.py` to assert the new name, the unchanged id `choose` and the unchanged question
- [x] T006 [P] [US2] Update `web/tests/unit/bands.test.ts` and `web/tests/e2e/stages.spec.ts` where they assert or describe "Choose the setup" (test titles and the timeline case "between Fit the model and Choose the setup")
- [x] T007 [P] [US2] Update `README.md` (the `stage_info.py` bullet and any other mention) and the module docstring of `B/stage_info.py` to the new name

---

## Phase 4: User Story 1 + 4 - Notes for all eight stages, numbers from constants (P1)

**Goal**: every stage has the agreed note; the five numbers come from their constants.
**Independent test**: `structure_extras()["notes"]["stages"]` has eight keys with the exact text, and the numbers test passes.

- [x] T008 [US1] In `B/stage_info.py` replace `CHOOSE_NOTE` and `SPLIT_NOTE` with one dict of the eight notes with exactly the text in spec FR-003: import `SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP`, `MARGIN_RUNS` from `B/state.py` and `len(GRID)` from `B/selection.py`; print the margin as a whole number when it is whole (as `B/goal.py` does); the "three years" wording uses the check count from T002
- [x] T009 [US1] Update `stage_notes()` in `B/stage_info.py` to return the eight notes (keeping its mapping/reasons check, so a stage with no node still needs a reason) and drop the `CHOOSE_STAGE`/`SPLIT_STAGE` special cases it no longer needs
- [x] T010 [P] [US1] Replace the choose, split and "every stage has a node" tests in `tests/test_stage_info.py` with: eight keys; each note equals the agreed text built from the constants; notes are plain text with no `<` or `>`
- [x] T011 [P] [US4] Create `tests/test_stage_notes_numbers.py`: find each number (8 in choose, 6 and 2 in choose, 24 in choose, 3 in frame and in assess) by its surrounding words and assert it equals `SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP`, `len(GRID)`, `MARGIN_RUNS`; monkeypatch one constant and rebuild the notes to show the text follows; assert the "three years" wording agrees with the check count and with `len(rolling_checks(...).checks)`
- [x] T012 [P] [US1] Update the web fixture: regenerate `web/tests/fixtures/linreg-structure.json` from `GET /api/structure` (server with `LLM_PROVIDER=fake`) so it carries the new name and notes; run the pytest drift test (`test_structure_stages.py`) to confirm it matches
- [x] T013 [US1] In `web/tests/e2e/stages.spec.ts` replace the cases that assert the old Choose and Split note text with ones that check every stage card shows its note under its question (read the expected text from `/api/structure`, never typed in the test)

---

## Phase 5: User Story 3 - General note from the data (P2)

**Goal**: one sentence naming the validation and test years; absent when the data cannot be read.
**Independent test**: with real data the note equals the sentence built from `rolling_checks`; with unreadable data `notes` has no `general` key.

- [x] T014 [US3] In `B/stage_info.py` change `loop_note()` to return `"Validation years: {y1}, {y2} and {y3}; test year: {test}, used once."` from `rolling_checks(load_innings(...))` (same call and years as today) and `None` on `DataError, IndexError, KeyError, ValueError`
- [x] T015 [US3] In `structure_extras()` in `B/stage_info.py` build `notes` with `general` only when `loop_note()` is not None
- [x] T016 [P] [US3] Replace the loop-note tests in `tests/test_stage_info.py` (years from the rolling checks; the exact sentence; no `general` key when the data is bad or missing, using the existing `tmp_path` cases) and fix any API test that expects `notes.general` to always exist
- [x] T017 [P] [US3] Update the e2e case "the loop note sits near the legend and names the real years" in `web/tests/e2e/stages.spec.ts` to the new sentence, with the years read from the structure response; check the legend still shows no empty note when `general` is absent (`web/src/graph-replay/legend.ts` already skips it; add a case with `serveStructure` and no `general`)

---

## Phase 6: Polish

- [x] T018 Run the full backend suite and `cd web && npm run test`, then the full Playwright suite (`npx playwright test`); fix any remaining assertion on old wording
- [x] T019 [P] `grep -rn "Choose the setup"` over `apps/`, `README.md` and `docs` again: nothing left outside `specs/`
- [x] T020 Run `quickstart.md`: open the graph page, read all eight notes against spec FR-003, change `ROUND_CAP` locally and see the note follow, then revert

---

## Dependencies and order

- T001 first. T002 and T003 before T008 and T014.
- US2 (T004-T007) is independent of US1/US3 and can go first or in parallel after Phase 2.
- US1+US4 (T008-T013): T008 then T009; tests T010, T011, T012 after T009; T013 after T012.
- US3 (T014-T017): T014 then T015; tests after. US3 touches `stage_info.py` like US1, so do it after T009.
- Polish last.

## Parallel opportunities

- T005, T006, T007 together (different files) after T004.
- T010, T011, T012 together after T009.
- T016 and T017 together after T015.
- T019 alongside T018.

## Implementation strategy

- **MVP**: Phases 1-3 (the rename), then US1+US4 (the notes), then US3. Each phase leaves the suites green; commit after each.
- Note: notes text is verbatim from the spec; do not reword it. If the exact text and a constant disagree (for example the spec says "three years" and the check count is not three), stop and ask.
