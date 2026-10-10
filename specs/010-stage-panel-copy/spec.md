# Feature Specification: Stages Panel Copy for a Data Scientist

**Feature Branch**: `010-stage-panel-copy` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-10
**Status**: Draft
**Input**: Rewrite the Stages panel copy on the linear regression app's graph page so a data scientist can read it and agree it is the pathway they would take, while the plain question on each card still serves a general reader. Copy and naming only.

## Context

The Stages panel on the graph page shows, for each of the eight stages, a name, a plain question and an optional note written by the app. Today only two stages (Choose the setup, Split the data) have a note, and the paragraph under the "All" button is a loop explanation written for a general reader. A data scientist reading the panel cannot tell whether the agent follows a sound modelling process.

The panel keeps two audiences: the **plain question** on each card stays as it is for a general reader, and a new **technical note** under it lets a data scientist check the method: how data is split, what is held out, what is fitted when, and how the winner is chosen.

The stage names and questions are shared by every algorithm app; the notes are specific to this app. This feature changes wording and one stage name only: the agent's behaviour, the graph and the panel's layout do not change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A data scientist can check the pathway (Priority: P1)

A data scientist opens the graph page and reads the eight stage cards. Each card carries a short technical note that states what that stage does, in terms they would use (expanding-window cross-validation, held-out test set, closed-form least squares, mean absolute error), without needing to read code. They can see that selection is done on validation error before the test year is touched, and that the test year is read once.

**Why this priority**: This is the whole purpose of the change.

**Independent test**: Read the structure response; every one of the eight stages has a note with exactly the agreed text.

**Acceptance Scenarios**:

1. **Given** the structure response, **Then** it carries a note for each of the eight stages (prepare, split, understand, frame, choose, fit, assess, interpret).
2. **Given** each note, **Then** its text matches the agreed wording exactly (see Requirements), with the numbers filled in from the app's own constants.
3. **Given** the panel, **Then** each card still shows its plain question above its note.

---

### User Story 2 - Stage 5 is named for what it is (Priority: P1)

Stage 5 is renamed from "Choose the setup" to "Choose the candidate model" everywhere the name is shown, because a candidate here is a feature subset plus hyperparameters, which a data scientist recognises as a model-selection step. Its identifier and its plain question do not change.

**Independent test**: The structure response names stage 5 "Choose the candidate model", its id is still `choose`, and its question is unchanged.

**Acceptance Scenarios**:

1. **Given** the structure response, **Then** stage 5's name is "Choose the candidate model", its id is `choose` and its question is the same as before.
2. **Given** the graph, legend, Event panel and timeline, **Then** the new name appears wherever the old one did and the old name appears nowhere.
3. **Given** the other apps that share the stage set, **Then** they show the new name too (the name lives in the shared stage set).

---

### User Story 3 - The general note states the years, from the data (Priority: P2)

The general paragraph under the "All" button becomes one sentence naming the validation years and the test year, worked out from the data. A visitor and a data scientist both see which years are used for what.

**Acceptance Scenarios**:

1. **Given** the data, **Then** the general note reads "Validation years: {y1}, {y2} and {y3}; test year: {test}, used once." with the years taken from the same rolling checks the agent uses.
2. **Given** the data changes (a new season is added), **Then** the years in the note change with it, with no edit to the wording.
3. **Given** the data cannot be read, **Then** no general note is sent at all, rather than a sentence without years.

---

### User Story 4 - The numbers cannot drift from the code (Priority: P2)

Every number in the notes that already exists as a constant in the app (the feature limit of 8, the round cap of 6, the stop after 2 rounds without improvement, the 3-run goal margin, the 24 grid combinations) is built from that constant. A test checks each number in the notes against its constant, so a change to a constant either updates the copy or fails a test.

**Acceptance Scenarios**:

1. **Given** each of the five numbers, **Then** the note text contains the constant's current value, built from the constant.
2. **Given** a constant is changed, **Then** the note changes with it (or a test fails if a number was typed by hand).

### Edge Cases

- A stage whose note mentions a number that is also a constant elsewhere (the 3-run margin appears in two notes): both are built from the one constant.
- The "3 check years" in the split note and the three years in the general note must agree with each other and with the number of rolling checks.
- Existing notes for Choose the setup and Split the data are replaced by the new text, not shown alongside it.
- Other apps with no technical notes keep working: a stage without a note simply shows its question.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Stage 5's name MUST be "Choose the candidate model"; its id (`choose`) and question MUST be unchanged. The name is changed in the shared stage set.
- **FR-002**: Every test, fixture and snapshot that asserts the old name MUST be updated to the new one, and no part of the product MUST show "Choose the setup".
- **FR-003**: The structure response MUST carry a note for all eight stages, with exactly the text below (numbers shown in braces come from constants; the rest is verbatim):
  - **prepare**: "Reads the prepared CSV into a pandas DataFrame and validates it."
  - **split**: "Split by calendar year, never at random. Expanding-window cross-validation: each of the three years before the latest is scored by a model trained only on earlier years, and the three mean absolute errors (MAE, the average miss in runs) are averaged. That average chooses the features, hyperparameters and winning method, while the coefficients are fitted only on each fold's training years. The latest year is the held-out test set, read once. Only IPL, BBL and full-member T20Is are scored."
  - **understand**: "Computes summary statistics to brief the LLM before it proposes: each feature's correlation with the final total, runs added by wickets down, and mean totals by competition and year. They guide the LLM's proposals only; no model is fitted on them."
  - **frame**: "Regression on the final total, scored by MAE. Before any fitting, two baselines are scored on the validation folds: the TV projection (run rate × 20) and a naive mean. The goal is to beat the TV projection by {3} runs of MAE on the test year."
  - **choose**: "Model selection. A candidate is a feature subset (up to {8}) plus three hyperparameters, set before fitting rather than learned: training window, recency weighting and training innings. The LLM proposes candidates; code rejects any that are invalid, already tried, too small to train on or perfectly collinear, then fits and cross-validates the rest. The loop runs up to {6} rounds and stops after {2} without improvement. As a benchmark, a grid search tries all {24} hyperparameter combinations, with forward feature selection inside each. Whichever method's best candidate has the lower cross-validated MAE wins, before the test year is read."
  - **fit**: "Fits the candidate in closed form (least squares via the normal equations, not gradient descent): an intercept plus one coefficient per feature, weighted when recency weighting is on. A separate fit is made for each validation fold, on only the years before it, and the loop repeats this for every new candidate. Solved directly in NumPy rather than scikit-learn (a test confirms identical coefficients) to stay within Vercel's size limit."
  - **assess**: "The winning candidate and the benchmark's best are refitted on every year before the test year, then scored once on the held-out test year alongside the TV projection and the naive mean. Selection was already settled on cross-validated MAE, so this is an unbiased estimate of performance on a new season. Reports MAE, R², share within 10 and 20 runs, error as a % of a typical total, and bias, and whether the {3}-run goal was met."
  - **interpret**: "Turns the results into cricket sentences from code templates. Every number is read from the run state, so the LLM cannot invent a figure. Feature importance is coefficient × interquartile range: how many runs a typical difference in that feature moves the prediction. Also states the winning window and half-life, and the test-year MAE against the TV projection and the goal."
- **FR-004**: The notes MUST live with the app's own code, not in the shared stage set, because they are specific to this app.
- **FR-005**: The general note MUST be exactly "Validation years: {y1}, {y2} and {y3}; test year: {test}, used once." with the years computed from the data by the same rolling checks the agent uses, never typed in.
- **FR-006**: If the data cannot be read, the general note MUST be omitted entirely.
- **FR-007**: The numbers 8 (feature limit), 6 (round cap), 2 (rounds without improvement before stopping), 3 (goal margin in runs) and 24 (grid combinations) MUST be taken from the constants that define them, not typed into the text.
- **FR-008**: A test MUST check each of those five numbers in the notes against its constant.
- **FR-009**: The agent's behaviour, the graph, the panel's layout and the unused `description` field MUST NOT change.

### Key Entities

- **Stage**: id, number, name, plain question (shared by all apps).
- **Stage note**: app-specific technical text for a stage, shown under its question.
- **General note**: one sentence under the "All" button naming the validation and test years.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 8 stages show a technical note and the 5 hand-written numbers in them (8, 6, 2, 3, 24) agree with the app's constants, checked by a test that fails if any one drifts.
- **SC-002**: The old stage name appears nowhere in the product or its tests; the new name appears in the structure response, legend, Event panel and timeline.
- **SC-003**: The general note names exactly three validation years and one test year, all equal to those the agent uses on the same data, and disappears when the data cannot be read.
- **SC-004**: A data scientist can read the eight notes top to bottom and find, without opening code, where selection happens (cross-validated MAE), what is held out (the latest year, read once), and what is fitted when (per fold, then refitted for the test).
- **SC-005**: Every existing backend and web test passes after the updates to names and notes, and no visual or behavioural difference remains apart from the copy.

## Assumptions

- The text in FR-003 is final and verbatim; wording changes are out of scope.
- The constants named in FR-007 already exist (state, setup settings, selection and goal modules) and are the single source for those numbers; if one does not exist as a constant yet, it is defined once and used for both the behaviour and the copy.
- The "three check years" in the split note is the number of rolling checks the agent uses; it is not one of the five listed numbers, and a test checks it agrees with the rolling checks.
- The explore step's statistics currently include the validation years, which the understand note describes without mentioning; fixing that is a separate feature.
- The shared stage set is used by other algorithm apps, so renaming stage 5 changes their display too; that is intended.
- Panel layout, collapsing of long notes and the unused `description` field are out of scope.
