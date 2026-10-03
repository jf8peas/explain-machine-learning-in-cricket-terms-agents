# Implementation Plan: Competition Dummy Variables

**Branch**: `003-competition-dummies` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification plus the technical decisions supplied with `/speckit-plan`.

## Summary

The data preparation script adds two 0/1 columns, `is_ipl` and `is_bbl`, right after `competition` in `innings.csv` (T20 International is the reference: both 0), and records them in `manifest.json`. One small app-specific module defines the mapping once and is used by the script, the `load_data` check, the Data tab and the tests. The agent's `load_data` step checks every row and stops the run with a clear count of wrong rows (an older file fails with the existing missing-columns error). The Data tab shows the two columns beside Competition, each with a 0/1 dropdown filter, and a closed-by-default "What are dummy variables?" section whose worked example is built from real rows. The model, features, tune loop and explanation are untouched, and a golden-file test proves the agent's run is identical.

## Technical Context

**Language/Version**: Python 3.12 (backend, script); TypeScript (web)
**Primary Dependencies**: Existing only: FastAPI, pandas, numpy; Tabulator via `<data-grid>`. No new dependencies
**Storage**: Committed files: `data/innings.csv` (two new columns) and `data/manifest.json` (new `dummies` entry)
**Testing**: pytest, Vitest, Playwright (existing setup)
**Target Platform**: Vercel (static plus Python function); evergreen browsers
**Project Type**: Web app inside the uv-workspace monorepo (same as 001 and 002)
**Performance Goals**: Unchanged. The every-row check is vectorised over about 5,100 rows (milliseconds); `/api/data` grows by roughly 5% (two small integer columns and a note)
**Constraints**: The agent's run must be identical; the Working tab unchanged; a failed script run leaves existing data files untouched; the mapping appears in one place only
**Scale/Scope**: About 5,100 rows, 12 columns after this feature, 3 competitions

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief instead: one definition of the mapping, the model is not touched, the Working tab and existing `data-testid`s are unchanged, and the reusable web modules stay free of cricket knowledge.

**Re-check after design**: no violations. The generic `notes` addition keeps `<data-grid>` free of cricket knowledge, and `data_loading.py` stays generic (see research.md, Decision 2).

## Project Structure

### Documentation (this feature)

```text
specs/003-competition-dummies/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── data-api-changes.md
└── checklists/
    └── requirements.md
```

### Source Code (additions and changes under `apps/linear_regression/`)

```text
backend/linreg/
├── competition_dummies.py   # NEW, app-specific: THE one definition of the mapping, PREPARED_COLUMNS,
│                            #   dummy_values, manifest_entry, add_dummies, check_dummies (DataError)
├── data_notes.py            # NEW, app-specific: the "What are dummy variables?" note, example built
│                            #   from real rows
├── data_loading.py          # CHANGED, stays generic: load_innings(path, required=...) argument
├── data_table.py            # CHANGED: two column definitions after competition, check on build,
│                            #   notes in the payload
└── nodes.py                 # CHANGED (load_data only): load with PREPARED_COLUMNS, call check_dummies
scripts/
└── prepare_data.py          # CHANGED: dummy values per row, atomic writes, manifest entry,
                             #   --from-existing, injectable fetch/sources for tests
data/
├── innings.csv              # CHANGED by running the script with --from-existing (two new columns)
└── manifest.json            # CHANGED by the same run ("dummies" entry; everything else identical)
tests/
├── conftest.py              # CHANGED: make_table adds the dummy columns
├── fixtures/golden_run.json # NEW: recorded BEFORE any change (agent run on the real data)
├── test_competition_dummies.py  # NEW
├── test_prepare_dummies.py      # NEW: script behaviour (unknown competition, atomic, --from-existing)
├── test_data_api.py         # CHANGED: new columns, notes, manifest counts
├── test_load_data_stop.py   # CHANGED: new stop cases
├── test_run_unchanged.py    # NEW: golden comparison
└── test_boundaries.py       # CHANGED: competition_dummies is app-specific; mapping appears once
web/
├── src/data-grid/
│   ├── types.ts             # CHANGED: optional notes in DataTable
│   ├── data-grid.ts         # CHANGED: render notes as closed collapsible sections beside the guide
│   ├── styles.ts            # CHANGED: note and example-table styles
│   └── README.md            # CHANGED: document notes
└── tests/
    ├── unit/table-view.test.ts  # CHANGED: select filter on a numeric column
    ├── unit/csv.test.ts         # CHANGED: dummy columns in the right position
    └── e2e/data-tab.spec.ts     # CHANGED: new tests; guide count 10 to 12; copy test spans new columns
```

**Structure decision**: The mapping lives in one backend module. The script, the loader's caller, the table builder, the note builder and the tests all import it. The web side only gains a generic `notes` renderer; nothing there knows about dummies.

## Design Notes

### The mapping module (`competition_dummies.py`)

- `REFERENCE = "t20i"`; `DUMMIES = {"is_ipl": "ipl", "is_bbl": "bbl"}` (ordered). `DUMMY_COLUMNS = list(DUMMIES)`.
- `PREPARED_COLUMNS` = the generic required columns with `DUMMY_COLUMNS` placed immediately after `competition`. This is the column order of `innings.csv`.
- `dummy_values(competition)` returns `{"is_ipl": 0|1, "is_bbl": 0|1}`; the reference gives `0, 0`; anything else raises `UnknownCompetition` naming the value and the allowed values.
- `manifest_entry()` returns `{"reference": "t20i", "columns": {"is_ipl": "ipl", "is_bbl": "bbl"}}`.
- `add_dummies(df)` adds or refreshes the columns in place order (for test builders).
- `check_dummies(df)` counts rows that are wrong in any way (missing or non-0/1 value, both 1, mismatch, unknown competition) and raises `DataError` with the count.

### `load_data` and `/api/data`

`nodes._load` loads with `required=PREPARED_COLUMNS`. `load_data` calls `check_dummies(df)` inside its existing `try`, next to the year and size checks, so a failure produces the existing stop update. `data_table.build_table` loads the same way and calls the same check, so a bad file gives HTTP 500 with the message and the Data tab shows its load-failure state with Retry.

### Script and committed data

Implementation order matters: record the golden run first (current data), then change code and tests, then run `uv run python scripts/prepare_data.py --from-existing` once to update the committed files, then verify the golden test and a diff of both files (the only differences are the two columns and the manifest entry).

### Data tab

`data_table.COLUMNS` is built from the mapping with the dummy definitions inserted after `competition`. The payload gains `notes` from `data_notes.build_notes(rows)`. In the grid, `build()` renders the notes next to the column guide inside one wrapper (`dg-help-row`), each as a `<details data-testid="note-<n>">`, closed, with paragraphs and an example `<table>`.

### Unchanged on purpose

`features.py`, `regression.py`, `evaluation.py`, `cricket_explanation.py`, `graph.py`, `state.py`, the tune loop, `graph-replay`, the results card, the try-your-own form and every existing `data-testid`.

## Testing Strategy

- **pytest** (see tasks for the file split):
  - the real data: every row's dummies agree with competition; no row has both set; counts of each dummy equal the manifest's `innings_kept` per competition and the Data tab summary;
  - the manifest has the `dummies` entry (columns, competitions, reference);
  - the script: an unknown competition stops with a message naming it and the existing files are byte-for-byte unchanged (both the download path with a fake fetch and `--from-existing`); `--from-existing` keeps every original value, the row order and the download date, and yields the same file when run twice;
  - `load_data`: an older file without the columns stops with the missing-columns error; the wrong-row count is right for a disagreeing row, a row with both set to 1, and a value other than 0 or 1 (and for several wrong rows at once);
  - `/api/data`: the two columns follow `competition` in both the column list and every row; a bad file returns 500 with the message;
  - the agent's run equals the golden file (same steps, features, errors and explanation);
  - the mapping text (`is_ipl`, `is_bbl`) appears in exactly one backend module (plus tests and data), enforced in `test_boundaries.py`.
- **Vitest**: the CSV has the two columns in the right position with the grid's headings; a select filter on a numeric column picks rows by value; a contradictory competition and dummy filter returns no rows.
- **Playwright**: the two columns follow Competition and their descriptions show on focus; competition and dummy filters combine, including the contradictory case showing the empty state; searching "IPL" returns only IPL rows; the "What are dummy variables?" section is closed by default and opens to show the explanation, the example and the "not used yet" statement; the CSV download contains the columns.
- **Regression**: all existing pytest, Vitest and Playwright tests pass; the three small existing-test updates are listed in research.md, Decision 9.

## Risks

1. **Script run changes the committed data more than intended.** Mitigation: `--from-existing` preserves values as text; a test and a final diff check show only the new columns and manifest entry differ.
2. **Golden file recorded after a change.** Mitigation: the first task records it from untouched code and commits it before anything else changes.
3. **Wording of the explanation.** SC-004 needs a person to judge it. Mitigation: the draft is in research.md for the owner to read and edit before release.

## Complexity Tracking

No constitution gates, so nothing to justify. One deliberate departure from the brief's wording (research.md, Decision 2): `data_loading.py` takes the required-column list as an argument instead of hard-coding the two dummy names, so the mapping stays defined in one place and `data_loading.py` stays generic.
