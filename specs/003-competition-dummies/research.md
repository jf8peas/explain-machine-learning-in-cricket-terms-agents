# Research: Competition Dummy Variables

Date: 2026-10-03. Every decision below was checked against the current code in `apps/linear_regression`. No new dependencies are needed, so there is no library comparison this time.

## Decision 1: One module owns the mapping

**Decision**: `backend/linreg/competition_dummies.py` (app-specific) defines the mapping once: reference category `t20i`, dummy columns in order `is_ipl` (competition `ipl`) then `is_bbl` (competition `bbl`). It also provides everything that depends on it:

- `dummy_values(competition)` for the script (raises `UnknownCompetition` naming the value);
- `manifest_entry()` for the manifest's `dummies` entry;
- `PREPARED_COLUMNS`, the full ordered column list (competition immediately followed by the dummies);
- `check_dummies(df)`, the every-row check that raises `DataError` with the number of wrong rows;
- `add_dummies(df)` for test data builders.

The preparation script, the `load_data` node, `data_table.py` (the grid columns and the worked example) and the tests import from it. Nothing else spells out `is_ipl`, `is_bbl` or the competition codes for the dummies. A boundary test checks that.

**Rationale**: The brief asks for a single definition. A change (for example adding a fourth competition) then happens in one file, and the script, the checks and the Data tab follow.

**Alternatives considered**: Keeping the mapping in `prepare_data.py` and importing it from the app (rejected: the app must not import from `scripts/`, and the script is not shipped to Vercel). Putting the check in `data_loading.py` (rejected: you asked it to stay generic).

## Decision 2: Required columns without making `data_loading.py` cricket-aware

**Decision**: `data_loading.load_innings` gets an optional `required` argument, defaulting to its current generic list, and keeps its current "missing columns" error. App code (the `load_data` node, and `data_table.build_table`) calls it with `PREPARED_COLUMNS` from `competition_dummies.py`. So an older file without the dummies fails with the existing message, "The innings data file is missing columns: is_ipl, is_bbl.", and the existing `load_data` stop branch ends the run.

**Rationale**: The brief fixes two things that conflict if taken literally: add `is_ipl` and `is_bbl` to `data_loading.py`'s required list, and keep `data_loading.py` generic with one definition of the mapping. Typing the two names into `data_loading.py` would repeat them in a second place and make a shared-library candidate know about cricket. Passing the required list in gives the same user-visible result (the existing missing-columns error, FR-016) with one definition.

**This is a deliberate deviation from the brief's wording.** If you would rather have the two names written into `data_loading.REQUIRED_COLUMNS`, the change is small: add them there, and add a test that they match `competition_dummies.DUMMY_COLUMNS` so the two lists cannot drift apart.

## Decision 3: Where the every-row check runs

**Decision**: `check_dummies(df)` runs in two places only: the `load_data` node (inside its existing `try`, so a `DataError` becomes the existing "stop" branch: `data_error`, `decision.branch = "stop"`, a summary that says the run stops) and `data_table.build_table` (so `/api/data` returns 500 with the same message and the Data tab shows its existing load-failure state). Later nodes reload the file without re-checking, because the graph never reaches them after a stop.

A row counts as wrong, once, if any of these holds: a dummy value is missing or not 0 or 1; both dummies are 1; either dummy differs from what its competition requires; or its competition is not one of the three known values. The message gives the number of wrong rows, for example: "3 rows have competition columns (is_ipl, is_bbl) that do not match their competition."

**Rationale**: It matches the spec (FR-016a) and keeps `explore`, `split`, `baseline`, `fit_model` and the rest untouched, so their results cannot change.

## Decision 4: The preparation script

**Decision**: Changes to `scripts/prepare_data.py`:

1. `rollup_match` adds the dummy values when it builds each row, using `dummy_values(competition)`. An unknown competition raises `UnknownCompetition("Unknown competition 'xyz' ...")` there, so the failure happens while rows are still being built and before anything is written. `COLUMNS` is built from `PREPARED_COLUMNS`.
2. Output goes through one `write_outputs(rows, manifest, data_dir)` that writes `innings.csv.tmp` and `manifest.json.tmp` in the data folder and only then replaces the real files (`os.replace`, innings file first, manifest second). If anything fails earlier, the real files are untouched. If the process dies in the narrow gap between the two replaces, the two files can be out of step. A re-run fixes that, and the manifest total is checked against the CSV by a test.
3. The manifest gets `"dummies": {"reference": "t20i", "columns": {"is_ipl": "ipl", "is_bbl": "bbl"}}`, from `manifest_entry()`.
4. `--from-existing` (a flag on `main`) reads the current `innings.csv`, keeps every row, its order and every original value exactly as read (as text, so nothing is reformatted), adds or refreshes `is_ipl` and `is_bbl`, loads the current `manifest.json`, adds or refreshes `dummies`, and keeps the download date, counts and sources. No network. An unknown competition in the file stops it with the same error before anything is written. A normal run (no flag) still downloads fresh data.
5. The download step takes the fetch function and the sources as arguments (defaults: `requests.get` and `SOURCES`), so tests can run the whole flow against a fake source.

The script imports `competition_dummies` by adding `backend/` to `sys.path` at the top (the tests already put `backend` and `scripts` on the path).

**Rationale**: The brief asks for temp-file-then-replace and a no-download rebuild that keeps the same innings and download date, so the committed data changes only by gaining two columns and a manifest entry.

**Alternatives considered**: Adding the columns once with a throwaway pandas snippet (rejected: the columns must come from the script, FR-004). Rewriting the CSV through pandas in `--from-existing` (rejected: it can reformat values; reading and writing text with the `csv` module keeps the original values byte for byte).

## Decision 5: Proving the agent's run is unchanged

**Decision**: Before touching the data, record the current agent run on the real data as a golden file, `tests/fixtures/golden_run.json`: for every step, its node, its summary and its `changes` (so steps, features, errors and the explanation are all in it). A test re-runs the graph and compares the full event list for equality. The run is deterministic (no randomness; least squares via numpy), so exact equality is the right check. It is recorded from the code before this feature, so it fails if any later step changes.

**Rationale**: SC-003 and FR-017 say "unchanged", so the test compares against a saved result from before the change rather than against numbers typed in today.

## Decision 6: The Data tab columns

**Decision**: `data_table.py` builds the two column definitions from `competition_dummies` (not retyped): key `is_ipl` / `is_bbl`, label "IPL (0/1)" / "BBL (0/1)" (made from the competition's display name), type `integer`, `filter: "select"`, and a description such as "1 if the innings was an IPL innings, otherwise 0. A T20 International innings has 0 here and 0 in BBL (0/1)." They are inserted immediately after `competition`, which is also where they sit in the CSV, so the existing check "rows equal `innings.csv` (plus `used_for`)" still holds.

**Does the generic select filter work on a numeric column?** Yes, with no code change. `table-view.ts` compares the filter's chosen value against `String(value)` of the cell, so `"1"` matches the number 1, and `filterOptions` lists the distinct values as text. Two points: options come out sorted ascending (0, then 1), not "1 then 0" as the spec words it, which does not matter; and a Vitest case will lock in the behaviour. If a gap shows up in testing, the fix stays generic.

CSV needs no change: it writes every column definition in order, with the grid's headings.

## Decision 7: Generic "notes" in the table payload

**Decision**: `DataTable` gets an optional `notes` list. Each note is `{ title, paragraphs: string[], example?: { caption?, columns: string[], rows: string[][] } }`. `<data-grid>` renders each note as a `<details>` section, closed by default, directly after the column guide and in the same row (the guide and notes sit side by side on wide screens and stack on narrow ones). Text is set with `textContent`, so nothing is interpreted as HTML. The component knows nothing about what a note says.

**Rationale**: The brief asks for a generic mechanism the other apps can reuse, and a collapsible section keeps the grid within easy reach (clarification 3).

## Decision 8: The explanation and its worked example

**Decision**: A new app-specific module, `backend/linreg/data_notes.py`, supplies the one note, "What are dummy variables?", and builds its example from the loaded data: the first row of each competition in file order, shown in the order T20 International, IPL, BBL (reference first), with columns Competition, "IPL (0/1)" and "BBL (0/1)". Values and names come from the rows and from `competition_dummies`, never typed in. If a competition has no row, its example row is left out (it cannot happen on the committed data, but it avoids a crash on a small file).

The wording is a draft that the owner should read, because SC-004 (a non-expert can explain the two-column idea) is judged by a person:

- **What it is.** A dummy variable is a yes/no question about an innings, written as a number: 1 means yes, 0 means no. "Was this an IPL innings?" is 1 for an IPL innings and 0 for any other.
- **Why they are needed.** A linear regression is arithmetic: it multiplies and adds numbers. It can work with "89 runs at 10 overs", but not with the word "IPL". Turning the word into 1s and 0s lets the model do sums with it.
- **Why two columns for three competitions.** Every innings here is a T20 International, an IPL or a BBL. If it is not IPL and not BBL, it must be a T20 International, so a third "Is this a T20 International?" column would only repeat what the first two already say. That repetition stops a linear regression from working properly: it cannot tell which of the repeating columns deserves the credit, so the sums break down. Two columns carry all the information.
- **The reference category.** T20 International has no column: an innings is a T20 International when both columns are 0. When a model uses these columns, each one will read as "how many more or fewer runs than a T20 International innings from the same position".
- **The example.** Three real innings from this table, one per competition, with their competition name and two dummy values.
- **Not used yet.** The agent's model does not use these columns yet. They are prepared and shown here only.

## Decision 9: Existing tests that need a small update

These break because the table gains two columns, not because behaviour changed:

- `tests/conftest.py` `make_table` (the real innings-table builder; `tests/fixtures/builders.py` only builds Cricsheet match JSON, and its rows pick up the dummies automatically through `rollup_match`) gets the dummy columns from `add_dummies`.
- `tests/test_data_api.py::test_tricky_venue_values_survive_json` writes its own two-row CSV, which needs the dummy columns.
- `web/tests/e2e/data-tab.spec.ts`: the column guide count changes from 10 to 12, and the range-copy test selects Competition to Venue, which now spans the two dummy columns, so its expected values include them.
- `tests/test_boundaries.py`: `competition_dummies` is added to the app-specific list, so shared modules cannot import it.

## Open questions

None. The one choice that departs from the brief's wording (Decision 2) is flagged above.
