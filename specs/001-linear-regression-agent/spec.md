# Feature Specification: Linear Regression Agent App (T20 First-Innings Total)

**Feature Branch**: `001-linear-regression-agent`
**Created**: 2026-10-01
**Status**: Draft
**Input**: First interactive agent app for "Explain Machine Learning in Cricket Terms": predict a T20 first innings' final total from the state of the innings at 10 overs, while the visitor watches the agent's graph solve the problem step by step.

## Context

This is the first of eight algorithm apps (linear regression, non-linear regression, logistic regression, KNN, k-means, decision tree, random forest, extra trees). Each is its own web app with its own endpoint, all living in this repo. The instructional website (separate repo) embeds or links to each app. The audience is cricket fans learning machine learning, not data scientists: every result is explained in cricket language.

## Clarifications

### Session 2026-10-01

- Q: What counts as the "most recent season" for the train/test split? → A: A single calendar-year cutoff on the match date: test on all innings in the latest calendar year, train on all earlier years, with all three competitions pooled.
- Q: How is the "set margin" for beating the broadcaster's projection defined? → A: Absolute: the model's average error must be at least 3 runs lower than the baseline's.
- Q: How does Play pace the run? → A: Paced playback: the full run is fetched quickly, but the display advances automatically at a readable pace (about 1–2 seconds per step), with Pause and a speed control.
- Q: Which innings does the model train on, and with which features? → A: One pooled model across all three competitions using only the three named features (runs at 10 overs, wickets at 10 overs, powerplay runs); competition and venue are shown in explore but not used to predict.
- Q: What does the app do if its data is missing or unusable? → A: Fail clearly at load_data: the failure is shown as that step's event and the run stops, with no model built on missing or thin data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the agent's plan as a flowchart (Priority: P1)

A visitor opens the app and, before anything runs, sees the whole agent drawn as a flowchart: every step as a node, edges between them, and dashed conditional edges labelled with their branch name (e.g. the choice after evaluation between "tune" and "explain").

**Why this priority**: The graph is the core teaching device; without it nothing else makes sense.

**Independent Test**: Load the app without pressing Play; confirm all steps, all edges, and labelled dashed conditional edges are visible.

**Acceptance Scenarios**:

1. **Given** the app has just loaded, **When** the visitor looks at the page, **Then** all nodes (load_data, explore, split, baseline, fit_model, evaluate, tune, explain_in_cricket_terms) and their edges are shown, with nothing highlighted as active.
2. **Given** the flowchart is shown, **When** the visitor inspects the branch after evaluate, **Then** two dashed edges are visible, each labelled with its branch name.

---

### User Story 2 - Play the run and watch it animate (Priority: P1)

The visitor presses Play. The agent runs and the flowchart animates: the active node is highlighted, a marker travels along the edge actually taken, visited nodes stay marked, and a node visited more than once shows a visit count.

**Why this priority**: Watching the agent work step by step is the headline experience.

**Independent Test**: Press Play and observe the animation through to completion, including the repeated fit_model/evaluate/tune visits.

**Acceptance Scenarios**:

1. **Given** the app is idle, **When** the visitor presses Play, **Then** steps appear one at a time in execution order, each highlighted while active.
2. **Given** a run is in progress, **When** the agent moves between nodes, **Then** a marker travels along the specific edge taken (including the conditional edge chosen).
3. **Given** a node has been visited, **When** the run moves on, **Then** it remains marked as visited, and a node visited more than once shows its count.
4. **Given** the visitor has enabled reduced motion in their system settings, **When** they play a run, **Then** highlighting and progress are shown without travelling animation.

---

### User Story 3 - Step, scrub and reset through the run (Priority: P1)

The visitor can step forward and back, jump to any step via a timeline of the path taken, and reset. Left and right arrow keys step backward and forward. Stepping back replays what was already received and does not rerun the agent.

**Why this priority**: Learners need to pause and revisit steps at their own pace.

**Independent Test**: After a completed run, step back several times and jump via the timeline; confirm no new run is triggered and displayed values match those originally received.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the visitor presses the left arrow key, **Then** the view moves to the previous step showing exactly what that step showed originally, and the agent is not rerun.
2. **Given** a run, **When** the visitor selects any entry in the timeline, **Then** the view jumps to that step.
3. **Given** a run (in progress or complete), **When** the visitor presses Reset, **Then** the view returns to the initial unrun flowchart.
4. **Given** the agent looped through tune, **When** the visitor views the timeline, **Then** repeated visits appear as separate entries in the order taken.

---

### User Story 4 - Inspect each step's event and accumulated state (Priority: P1)

At each step the visitor sees the event the node produced (what it did, in plain words) and the graph's accumulated state so far, with the values that this step changed highlighted.

**Why this priority**: This is how the visitor understands what each step contributes.

**Independent Test**: Select each step in turn and confirm the event and state panel show the step's output, with only newly changed values highlighted.

**Acceptance Scenarios**:

1. **Given** any step is selected, **When** the visitor looks at the detail panel, **Then** they see that step's event and the full accumulated state.
2. **Given** a step changed some state values, **When** it is selected, **Then** exactly those values are visually highlighted and others are not.

---

### User Story 5 - Watch the tune loop reduce the error (Priority: P2)

The visitor sees the agent fit on runs at 10 overs alone, find it does not beat the broadcaster's projection by the required margin, add wickets at 10 overs, then (if needed) powerplay runs, with the average error shown dropping with each added feature.

**Why this priority**: Shows why feature choice matters, the main learning point after the basic walkthrough.

**Independent Test**: Complete a run and confirm the error after each fit is visible and comparable across loop iterations, and that the loop always ends.

**Acceptance Scenarios**:

1. **Given** the model's error is not at least 3 runs better than the baseline and untried features remain, **When** evaluate completes, **Then** the agent takes the "tune" branch, adds the next feature and refits.
2. **Given** the model is at least 3 runs better than the baseline, or no features remain, or the loop cap is reached, **When** evaluate completes, **Then** the agent takes the "explain" branch.
3. **Given** several loop iterations, **When** the visitor views the run, **Then** the error for each feature set is shown side by side.

---

### User Story 6 - Cricket-language explanation and comparison with the TV projection (Priority: P2)

The run ends with plain cricket sentences derived from the fitted model: how many runs each extra wicket at the halfway mark costs by the end of the innings, which feature mattered most, and how far off the prediction usually is compared with the broadcaster's projected score, with a clear verdict on whether the model beat it.

**Why this priority**: Converts the numbers into understanding for a non-ML audience.

**Independent Test**: Read the final explanation and confirm each number matches the run's state and that the most important feature is identifiable without ML knowledge.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the explanation is shown, **Then** every number in it equals a value from that run's state.
2. **Given** a completed run, **When** a reader with no ML background reads it, **Then** they can state which feature mattered most.
3. **Given** a completed run, **When** the comparison is shown, **Then** model and broadcaster errors (in runs) are shown together with a clear "beat / did not beat" statement.

---

### User Story 7 - Try my own innings (Priority: P3)

After a run, the visitor enters runs and wickets at 10 overs and powerplay runs for an innings of their own and sees the model's predicted total next to the broadcaster's projection.

**Why this priority**: Fun, hands-on extension; not required to understand the algorithm.

**Independent Test**: Enter sample inputs and confirm both predictions appear, with invalid inputs rejected clearly.

**Acceptance Scenarios**:

1. **Given** a completed run, **When** the visitor enters valid runs, wickets and powerplay runs, **Then** the model's prediction and the broadcaster's projection (run rate × 20 overs) are shown side by side.
2. **Given** inputs outside cricketing limits (negative runs, more than 9 wickets at 10 overs, powerplay runs greater than runs at 10 overs), **When** submitted, **Then** a clear message explains the problem and no prediction is shown.

---

### Edge Cases

- No feature set is at least 3 runs better than the baseline: the loop ends when features run out and the explanation states honestly that the model did not clear the 3-run margin (and whether it beat the baseline at all).
- The model beats the baseline on the first fit: the loop is never entered, and the timeline shows no tune visit.
- The visitor presses Play again mid-run or after completion: the view resets and starts a fresh run without duplicating steps.
- The connection drops mid-run: the visitor sees a clear message, and steps already received remain viewable.
- Stepping forward past the last received step or back before the first is ignored.
- A wicket coefficient that is not negative, or a feature with no measurable effect: the explanation describes what the run actually found rather than a canned sentence.
- The latest calendar year has few innings (e.g. a part-complete year): the app reports the test-set size so results can be judged; below 100 test innings the run fails at load_data (FR-007a).
- User-entered innings at extremes (0 runs, 9 wickets) are handled within valid limits without errors.

## Requirements *(mandatory)*

### Functional Requirements

**Problem and data**

- **FR-001**: The app MUST predict a T20 first innings' final total from the state of the innings after 10 overs.
- **FR-002**: The app MUST use ball-by-ball T20 data from Cricsheet covering men's T20 internationals, IPL and BBL, rolled up to one row per innings with: runs at 10 overs, wickets at 10 overs, powerplay runs (overs 1–6), final total, season, competition, venue.
- **FR-003**: The data MUST include first innings only.
- **FR-004**: The data MUST exclude no-result innings, reduced-overs or DLS-affected innings, and innings that ended before 10 overs were completed, including innings where the side was all out (10 wickets) by the end of the 10th over.
- **FR-005**: A visible attribution to Cricsheet MUST appear wherever the data is used or results derived from it are shown.

**Agent steps and flow**

- **FR-006**: The agent MUST perform these steps, each a visible node: load_data, explore, split, baseline, fit_model, evaluate, tune, explain_in_cricket_terms.
- **FR-007**: load_data MUST report the number of innings, seasons and competitions covered.
- **FR-007a**: If the prepared innings table is missing, empty, or leaves too few innings in the test year to evaluate (fewer than 100), load_data MUST fail visibly: the failure and its reason are shown as that step's event, the run stops, and no later step executes.
- **FR-008**: explore MUST show how closely runs at 10 overs relates to the final total and how wickets lost changes that relationship, and MUST also show how final totals differ by competition (informational only; not a model input).
- **FR-009**: split MUST train on all innings from earlier calendar years and test on all innings from the most recent calendar year (by match date, all three competitions pooled), and MUST NOT split randomly.
- **FR-010**: baseline MUST compute the broadcaster's projected score (current run rate × 20 overs) for every test innings and its average error in runs.
- **FR-011**: fit_model MUST fit a single linear model, pooled across all competitions, on the current feature set, starting with runs at 10 overs only. Only runs at 10 overs, wickets at 10 overs and powerplay runs may be used as predictors; competition, venue and season are not.
- **FR-012**: evaluate MUST measure the model's average error in runs and R² on the test year (the latest calendar year) and compare with the baseline.
- **FR-013**: After evaluate, the agent MUST go to tune if the model's average error is not at least 3 runs lower than the baseline's average error and untried features remain; otherwise to explain_in_cricket_terms.
- **FR-014**: tune MUST add the next feature (wickets at 10 overs, then powerplay runs) and return to fit_model.
- **FR-015**: The loop MUST be capped so every run terminates.
- **FR-016**: explain_in_cricket_terms MUST turn coefficients and errors into plain cricket sentences, including the run cost of each wicket lost at the halfway mark by the end of the innings and how far off predictions usually are versus the broadcaster's projection.
- **FR-017**: Every number in the explanation MUST come from the actual run; no fixed figures in text.
- **FR-018**: The explanation MUST make clear which feature mattered most, in language a non-ML reader understands.
- **FR-019**: The final comparison MUST state plainly whether the model beat the broadcaster's projected score.

**Visualiser**

- **FR-020**: Before any run, the visualiser MUST display the full graph: nodes, edges, and dashed conditional edges labelled with their branch name.
- **FR-021**: On Play, the visualiser MUST highlight the active node, animate a marker along the edge taken, keep visited nodes marked, and show a count on nodes visited more than once.
- **FR-021a**: Playback MUST advance automatically at a readable pace (default about 1–2 seconds per step, independent of how fast the agent runs), and the visitor MUST be able to pause, resume and change the speed. Steps received ahead of the display are held until their turn.
- **FR-022**: The visitor MUST be able to step forward and back, jump to any step from a timeline of the path taken, and reset.
- **FR-023**: Stepping back or jumping MUST replay received events without rerunning the agent.
- **FR-024**: At each step the visitor MUST see the event produced and the accumulated state, with values changed by that step highlighted.
- **FR-025**: Left and right arrow keys MUST step backward and forward.
- **FR-026**: The app MUST respect the visitor's reduced-motion setting by removing travelling animation while keeping all information available.

**Try-your-own**

- **FR-027**: The visitor MUST be able to enter runs at 10 overs, wickets at 10 overs and powerplay runs and see the model's predicted total beside the broadcaster's projection.
- **FR-028**: Invalid inputs MUST be rejected with a clear message.

**Website and reuse**

- **FR-029**: The app MUST expose, for the website to use, (a) the graph's structure (nodes and edges, including conditional edges and branch names) and (b) a live stream delivering one event per completed node.
- **FR-030**: The visualiser MUST be driven solely by that structure and those events, with no knowledge of linear regression or cricket, so the other seven apps can reuse it unchanged.
- **FR-031**: Candidate shared-library pieces (data loading, season split, evaluation, cricket explanation, structure and stream interfaces, the visualiser) MUST be identifiable as separate, clearly bounded parts of this app. They remain inside this app until extraction after the second app is built.

### Key Entities

- **Innings record**: one row per first innings: runs at 10 overs, wickets at 10 overs, powerplay runs, final total, season, competition, venue.
- **Graph structure**: nodes, edges, and for conditional edges a branch name.
- **Step event**: one per completed node: node name, step number, plain-language summary, and what the step changed.
- **Run state**: accumulated values across steps (data summary, split sizes, baseline error, current feature set, coefficients, model error, R², decision taken, explanation).
- **Feature set**: ordered list of features tried; starts with runs at 10 overs.
- **Explanation**: cricket-language sentences generated from run state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the held-out test year (the latest calendar year), the final model's average error in runs is lower than the broadcaster's projected score's average error.
- **SC-002**: After pressing Play, the agent completes the full run and all step events are received within 5 seconds (excluding first cold start); the first step appears on screen within 1 second of being received, and on-screen pacing then follows FR-021a.
- **SC-003**: 100% of numbers in the explanation match values in the run's recorded state, with none hard-coded.
- **SC-004**: At least 90% of at least 10 test readers with no ML background can correctly name the most important feature after reading the explanation.
- **SC-005**: Stepping back or jumping to any prior step displays the original values instantly, with zero new agent runs triggered.
- **SC-006**: Every run terminates, including when no feature set beats the baseline.
- **SC-007**: The same visualiser, given a different graph structure and event stream, displays it correctly with no changes to the visualiser.
- **SC-008**: Every page that shows data or results carries the Cricsheet attribution.
- **SC-009**: All playback controls are usable by keyboard and with reduced motion enabled.

## Assumptions

- The margin for "good enough" is 3 runs of average error below the baseline; it is a single named setting so it can be changed without altering behaviour elsewhere.
- The "most recent season" is the latest calendar year of match dates present in the data; the test set is that year and the training set is all earlier years.
- Average error means mean absolute error in runs.
- Data is prepared ahead of time as a rolled-up table rather than downloaded live per visitor.
- The loop cap equals the number of available features, so at most three fits occur.
- The first cold start may take longer than a few seconds.
- The app is public and read-only; no account or login is needed.
- Cricsheet's data licence permits this educational use with attribution.

## Out of Scope

- The other seven algorithms.
- Live match data.
- User accounts.
- Any betting or odds content.
- Extracting the shared library (deferred until after the second app).
