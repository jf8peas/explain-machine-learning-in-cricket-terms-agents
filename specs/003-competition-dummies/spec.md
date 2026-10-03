# Feature Specification: Competition Dummy Variables

**Feature Branch**: `003-competition-dummies` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-03
**Status**: Draft
**Input**: Add competition dummy variables to the prepared innings data, created by the data preparation script, and document them on the Data tab.

## Context

This extends the linear regression agent app (features 001 and 002). The prepared innings table has one row per first innings and includes a text column "Competition" with three values: T20 International, IPL and BBL. It is produced by the data preparation script, and the Data tab (feature 002) shows it and lets visitors download it.

A linear regression can only do arithmetic with numbers, so a text category has to be converted into 0/1 columns called dummy variables before a model can use it. This feature adds those columns to the data and explains them to visitors, who are cricket fans learning machine learning.

This feature prepares and documents the data only. Using the dummy columns in the model is a separate, later feature, so the agent's behaviour does not change here.

## Clarifications

### Session 2026-10-03

- Q: How do visitors filter by a dummy column? → A: Each dummy column gets its own dropdown filter (All, 0, 1) next to the Competition filter.
- Q: What happens if the data file has the dummy columns but they are wrong? → A: `load_data` checks every row; if any dummy disagrees with Competition or is not 0 or 1, the run stops with a clear data error saying how many rows are wrong.
- Q: Where does the explanation go, and is it open or closed? → A: A separate collapsible section (titled like "What are dummy variables?"), closed by default, placed above the grid next to the column guide.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the dummy columns beside Competition and check they match (Priority: P1)

On the Data tab the visitor sees two new columns, "IPL (0/1)" and "BBL (0/1)", right next to the Competition column. IPL rows show 1 in the IPL column and 0 in the BBL column; BBL rows show 0 and 1; T20 International rows show 0 and 0.

**Why this priority**: Seeing the real rows is how a visitor checks for themselves that the numbers match the words.

**Independent Test**: Open the Data tab, look at a few rows from each competition, then filter by competition and by a dummy column.

**Acceptance Scenarios**:

1. **Given** the Data tab, **When** it loads, **Then** "IPL (0/1)" and "BBL (0/1)" appear immediately after Competition.
2. **Given** any IPL row, **Then** IPL (0/1) is 1 and BBL (0/1) is 0; **given** any BBL row, **Then** the values are 0 and 1; **given** any T20 International row, **Then** both are 0.
3. **Given** a dummy column heading, **When** the visitor hovers or focuses it, **Then** its description appears, and the same description appears in the column guide.
4. **Given** the grid, **When** the visitor sorts by a dummy column, **Then** it sorts like any other numeric column.
5. **Given** the toolbar, **Then** each dummy column has its own dropdown filter (All, 0, 1) beside the Competition filter; **when** the visitor filters by Competition and by a dummy column together, **Then** the result is consistent (for example, IPL with IPL (0/1) = 1 shows all IPL rows; IPL with BBL (0/1) = 1 shows none and the empty state appears).
6. **Given** the Competition column, **Then** it is unchanged: it still shows the full competition names.

---

### User Story 2 - Understand what dummy columns are and why T20 International has none (Priority: P1)

The Data tab has a short explanation, in plain cricket language, that a reader with no machine learning background can follow. It covers what a dummy variable is, why they are needed, why there are two columns for three competitions, and what the reference category means. It includes a worked example of three sample rows, one per competition, and says plainly that the current model does not use these columns yet.

**Why this priority**: The columns mean little to the audience without the explanation, and the "two columns for three competitions" idea is the part people find least obvious.

**Independent Test**: Give a reader with no machine learning background the Data tab and ask them to explain, in their own words, why there are two columns for three competitions.

**Acceptance Scenarios**:

1. **Given** the Data tab, **Then** the explanation covers: a dummy variable is a yes/no question about the innings written as 1 or 0; the model can do arithmetic with numbers but not with the word "IPL"; two columns are enough for three competitions because an innings that is neither IPL nor BBL must be a T20 International, so a third column would repeat information the model already has, and that repetition stops a linear regression from working properly; and when the model uses these columns, each one will read as "how many more or fewer runs than a T20 International innings from the same position".
2. **Given** the explanation, **Then** it includes a small worked example with three sample rows, one per competition, showing the competition name and the two dummy values; the values shown agree with the data.
3. **Given** the explanation, **Then** it states plainly that the current model does not use these columns yet.
4. **Given** the Data tab on a normal screen, **Then** the explanation is a separate collapsible section titled like "What are dummy variables?", closed by default, placed above the grid next to the column guide, and opening it reveals the full explanation, worked example and the statement that the model does not use the columns yet.

---

### User Story 3 - Download the CSV with the dummy columns (Priority: P2)

The CSV the visitor downloads from the Data tab includes the two dummy columns, in the same position and with the same headings as in the grid.

**Why this priority**: Visitors who take the data away should get the same columns they saw.

**Independent Test**: Download the all-rows CSV and open it in a spreadsheet.

**Acceptance Scenarios**:

1. **Given** the download of all rows, **Then** the file has "IPL (0/1)" and "BBL (0/1)" columns next to Competition, with a 0 or 1 in every row.
2. **Given** a filter or sort is active and the visitor downloads the rows shown, **Then** the dummy columns are included and match the rows shown.

---

### User Story 4 - Re-run the preparation script and always get the dummies (Priority: P2)

The site owner re-runs the data preparation script and gets the table with the dummy columns every time, and the data's manifest describes them: which columns, which competition each stands for, and which competition is the reference category.

**Why this priority**: The columns must come from the data preparation step, never be added by hand or calculated later in the app, so the data stays reproducible and traceable.

**Independent Test**: Re-run the script on the same downloads and compare the result and the manifest.

**Acceptance Scenarios**:

1. **Given** a successful run of the script, **Then** every row has both dummy columns, correct for its competition.
2. **Given** the manifest, **Then** it lists the two dummy columns, the competition each represents, and T20 International as the reference category.
3. **Given** the script meets a competition value it does not recognise, **Then** it stops with a clear error naming the unrecognised value, and no data file is written with wrong or missing dummies (an existing good file is left as it was).
4. **Given** the app is given an older data file without the dummy columns, **Then** the agent's load_data step reports a clear data error and the run does not continue.
5. **Given** a data file whose dummy columns disagree with Competition (for example an IPL row with IPL (0/1) = 0, a row with both set to 1, or a value other than 0 or 1), **Then** load_data checks every row, stops the run with a clear data error, and says how many rows are wrong.

---

### Edge Cases

- A row must never have both dummy columns set to 1; a file where this happens, or where a dummy disagrees with Competition, stops the run at load_data with a clear data error stating the number of wrong rows.
- A competition value the script does not recognise stops the script with a clear error; no partial or wrong file is written.
- An older data file without the dummy columns produces a clear data error at the load_data step, and the run stops (the same way other unusable data does).
- Filtering by Competition and by a dummy column at the same time gives consistent results, including an empty result (and the usual empty-state message) when they contradict.
- Searching for "IPL" still matches by the Competition column's displayed text; the 0/1 columns do not cause extra matches for the text "IPL".
- The Data tab, the CSV, the summary and the agent's own table all describe the same rows, so counts still agree.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The prepared innings table MUST have two additional columns: one that is 1 for IPL innings and 0 otherwise, and one that is 1 for BBL innings and 0 otherwise.
- **FR-002**: T20 International MUST be the reference category: it MUST have no column of its own, and a T20 International innings MUST be the row where both dummy columns are 0.
- **FR-003**: The existing Competition column MUST be kept unchanged.
- **FR-004**: The dummy columns MUST be created by the data preparation script as part of producing the table, and MUST NOT be added by hand or calculated later by the app.
- **FR-005**: If the script meets a competition value it does not recognise, it MUST stop with a clear error naming that value, and MUST NOT write a data file with wrong or missing dummies.
- **FR-006**: No row MAY have both dummy columns equal to 1, and every value MUST be 0 or 1.
- **FR-007**: The data's manifest MUST record the dummy columns, which competition each one represents, and which competition is the reference category.
- **FR-008**: The Data tab grid MUST show the dummy columns with friendly headings ("IPL (0/1)" and "BBL (0/1)"), placed immediately after the Competition column.
- **FR-009**: Each dummy column MUST have a description available on hover or focus and in the column guide, like the other columns.
- **FR-010**: The dummy columns MUST be sortable like other numeric columns, and each MUST have its own dropdown filter (All, 0, 1, in that order) beside the Competition filter; filtering by Competition and a dummy column together MUST combine them (a row must satisfy both) and give consistent results.
- **FR-011**: The CSV download MUST include the dummy columns with the grid's headings and position, in both the all-rows and rows-shown downloads.
- **FR-012**: The Data tab MUST show a short plain-language explanation covering what a dummy variable is, why dummies are needed, why there are two columns for three competitions, and what the reference category means, including how each column will read once a model uses it ("how many more or fewer runs than a T20 International innings from the same position").
- **FR-013**: The explanation MUST include a small worked example of three sample rows, one per competition, showing the competition name and the two dummy values, and the example MUST agree with the data.
- **FR-014**: The explanation MUST state plainly that the current model does not use these columns yet.
- **FR-015**: The explanation MUST be a separate collapsible section (titled like "What are dummy variables?"), closed by default, placed above the grid next to the column guide, so the grid stays easy to reach.
- **FR-016**: When the app is given a data file without the dummy columns, the agent's load_data step MUST report a clear data error and the run MUST NOT continue.
- **FR-016a**: The agent's load_data step MUST also check every row's dummy values against its Competition value (and that each value is 0 or 1); if any row is wrong it MUST stop the run with a clear data error that says how many rows are wrong.
- **FR-017**: The agent's run on the same innings MUST be unchanged by this feature: same steps, same features, same errors and same explanation.
- **FR-018**: The Working tab MUST be unchanged.

### Key Entities

- **Competition dummy column**: a 0/1 column that answers one yes/no question about an innings ("Is this an IPL innings?" or "Is this a BBL innings?").
- **Reference category**: the competition with no column of its own (T20 International), represented by both dummy columns being 0.
- **Dummy description (manifest)**: for each dummy column, its name and the competition it represents, plus the reference category.
- **Innings row**: as before, with the two dummy values added.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every row, the dummy columns agree with the Competition column: IPL rows are 1 and 0, BBL rows are 0 and 1, T20 International rows are 0 and 0 (100% of rows, no row with both set to 1).
- **SC-002**: The number of rows with each dummy set to 1 equals the per-competition count shown in the Data tab summary for that competition.
- **SC-003**: The agent's run on the same innings is unchanged: same steps, same features, same errors and same explanation.
- **SC-004**: A reader with no machine learning background can explain, after reading the Data tab, why there are two columns for three competitions.
- **SC-005**: Re-running the preparation script yields the dummy columns and a manifest entry describing them every time; an unrecognised competition stops the script and writes nothing.
- **SC-006**: The downloaded CSV contains the dummy columns, matching the grid in headings, position and values.
- **SC-007**: All existing tests still pass.

## Assumptions

- The text column "Competition" holds the three competitions the app already uses (T20 International, IPL, BBL), shown in full names in the Data tab.
- The two dummy columns follow the Competition column in the stored table too, in the order IPL then BBL.
- "A competition value it does not recognise" means any value other than those three.
- Re-running the script on unchanged downloads gives the same table; the dummy columns do not change which innings are kept.
- Existing test data and helpers that build innings tables will be updated to include the dummy columns, since the data file is now required to have them.
- The worked example shows three real rows from the data (one per competition), and stays correct when the data is re-prepared.
- The data-tab column guide and tooltips use the same description text.

## Out of Scope

- Using the dummy columns as model features, changing the tune loop or feature selection.
- Dummy variables for venue or season, or for any other column.
- Any change to the Working tab or the agent's steps, features, errors or explanation.
- Changing which matches or innings are kept, or the train/test split.
