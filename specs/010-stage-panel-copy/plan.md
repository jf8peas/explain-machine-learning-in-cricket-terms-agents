# Implementation Plan: Stages Panel Copy for a Data Scientist

**Branch**: `010-stage-panel-copy` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)
**Input**: The specification. Choices left open are in [research.md](research.md).

## Summary

One stage is renamed in the shared stage set, eight notes are written in the app's own `stage_info.py` with every number built from the constant that defines it, and the general note becomes one sentence built from the rolling checks. Nothing in the agent, the graph, the panel's layout or the structure response's shape changes: only the wording of `stages[4].name`, `notes.stages.*` and `notes.general` (which is now left out when the data cannot be read). A new test ties each number in the notes to its constant.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web), tests only
**Primary Dependencies**: existing only. No new dependency
**Storage**: None
**Testing**: pytest (`tests/test_stage_info.py`, `tests/test_stages.py`, structure tests), Vitest (`web/tests/unit/bands.test.ts`, fixture), Playwright (`web/tests/e2e/stages.spec.ts`)
**Target Platform**: Vercel (static plus the Python function)
**Project Type**: web app in the uv-workspace monorepo
**Constraints**: copy and naming only; the notes text is verbatim (spec FR-003); numbers come from `state.py` (`SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP`, `MARGIN_RUNS`) and `selection.py` (`len(GRID)`); the years come from `rolling_checks()`; the shared `stages.py` holds no app knowledge
**Scale/Scope**: 8 notes, 1 name, 1 general sentence

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles applied from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | The five numbers and the years are read from their constants and the data, never typed |
| Every number comes from code | A test fails if a number in a note differs from its constant |
| App knowledge stays in the app | Notes are in `stage_info.py`; only the stage 5 name changes in the shared `stages.py` |
| No new dependencies | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-stage-panel-copy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/structure.md   # the diff against the structure response
├── checklists/requirements.md
└── tasks.md                 # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── stages.py        # CHANGED: stage 5 name -> "Choose the candidate model" (id, question unchanged)
├── stage_info.py    # CHANGED: eight notes built from constants; loop_note() -> one sentence or None;
│                    #          structure_extras() leaves out notes.general when it is None; CHOOSE_NOTE/SPLIT_NOTE replaced
└── season_split.py  # CHANGED only if no constant yet gives the number of check years: define it once, use it in rolling_checks and the split note
tests/test_stage_info.py, test_stages.py (and any structure test naming the old stage or notes)   # CHANGED
tests/test_stage_notes_numbers.py                                                                  # NEW: each number against its constant
web/tests/fixtures/linreg-structure.json   # CHANGED: regenerated from GET /api/structure (name, notes, general)
web/tests/unit/bands.test.ts, web/tests/e2e/stages.spec.ts   # CHANGED: name, note assertions, general note
README.md, backend/linreg/stage_info.py docstring            # CHANGED: wording that names "Choose the setup"
```

**Structure Decision**: no new modules. `stage_notes()` keeps its signature (mapping, reasons) and its check that a stage with no node has a reason; it now returns a note for every stage.

## Design

- **Notes**: one module-level dict built with f-strings in `stage_info.py`: `SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP`, `MARGIN_RUNS` (printed as a whole number when it is whole, as `goal.py` already does), `len(selection.GRID)`. The wording about "the three years" uses the number of checks (see research). `stage_notes()` returns the dict plus a reason for any stage with no node (none today).
- **Import direction**: `stage_info.py` imports `selection` for `GRID`; `selection` must not import `stage_info` (to be confirmed when implementing).
- **General note**: `loop_note(data_path)` returns `"Validation years: {y1}, {y2} and {y3}; test year: {test}, used once."` from `rolling_checks(load_innings(...))` (the call it makes today), or `None` on `DataError, IndexError, KeyError, ValueError`. `structure_extras` builds `notes` with `general` only when it is not None. The web legend already shows nothing when `notes.general` is absent.
- **Rename**: only `Stage("choose", 5, "Choose the candidate model", ...)` changes. Search the repo for the old name and fix every hit (README, tests, fixture; earlier specs stay as history).
- **Fixture**: `web/tests/fixtures/linreg-structure.json` is regenerated from the running app, as the existing pytest drift test requires, not hand-edited.

## Testing

- `test_stage_info.py`: replace the choose/split/loop-note tests with: all eight stages have a note equal to the agreed text built from the constants; the general note equals the sentence with the years from `rolling_checks`; with unreadable data `notes` has no `general` key.
- `test_stage_notes_numbers.py`: for each of 8, 6, 2, 3 (the margin, in both notes it appears) and 24, find the number in the right note (by its surrounding words) and assert it equals the constant; change a constant with `monkeypatch` and rebuild the notes to show the text follows. Also check the "three years" wording agrees with the number of rolling checks.
- `test_stages.py`: stage 5 name, id and question.
- Web: the fixture-based unit test and the e2e cases that mention the old name or the old notes, the legend general-note case, and a case that each stage card shows its note under its question.
- Full backend and web suites pass.
