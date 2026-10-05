# Feature Specification: LLM-Driven Feature Selection

**Feature Branch**: `004-llm-feature-selection` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-04
**Status**: Draft
**Input**: Add LLM-driven feature selection to the linear regression agent app: a language model proposes which features to try next, ordinary code fits and scores each proposal, and the visitor chooses which model does the proposing.

## Context

This extends the linear regression agent app (features 001 to 003). Today the agent adds three features in a fixed order. That is not real feature selection, and with only three candidates there is little to choose between.

The aim is to show what a non-deterministic step adds to an agent: a language model uses cricket knowledge and the results so far to decide what to try next, while every number is still produced by ordinary code. The audience is cricket fans learning machine learning. They should see why the agent tried each feature set, and whether its reasoning beat a simple mechanical method.

Runs are live: each press of Play calls a language model through the site owner's account with an external model provider (OpenRouter). That has a cost and can be abused, so the owner's account and key are protected (see "Protecting the owner's account").

## Clarifications

### Session 2026-10-04

- Q: How should proposals with redundant features be handled (for example wickets in hand alongside wickets lost)? → A: Code rejects a proposal if any feature is an exact combination of the others in the set; it is shown as a rejected step with the reason and counts towards the cap, and forward selection skips such additions.
- Q: Is there a limit on how many features a proposal can contain? → A: A fixed cap of 8 features per set; a larger proposal is rejected by code with the reason and counts towards the round cap, and forward selection also stops at 8.
- Q: What happens if the visitor presses Play again during a run? → A: Play is disabled while a run is in progress, so no second run can start; a request that gets through anyway (a second tab, an altered request) is refused with a clear message; Reset is disabled too, until the run ends, because it would abandon a run the server is still working on; Back and Step still replay the steps received. (This replaces the old "Play again starts clean" behaviour.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a language model choose features, and see why (Priority: P1)

The visitor presses Play. The agent loads and explores the data, then a language model step proposes a feature set to try next, with a one- or two-sentence reason in cricket language. Code fits that set on the training years and scores it on the validation year. The loop repeats, each round informed by the results so far, until the model says it is finished, two rounds in a row bring no improvement, or the cap of about six rounds is reached.

**Why this priority**: This is the point of the feature: showing what a language-model step contributes, and that its decisions are explained.

**Independent Test**: Run the agent with a scripted stand-in for the language model and check the sequence of proposals, evaluations and stopping rules.

**Acceptance Scenarios**:

1. **Given** a run, **When** the language model proposes a set, **Then** the visitor sees the chosen features and the model's reason exactly as given, clearly labelled as the model's reasoning.
2. **Given** a proposal, **Then** code fits it on the training years and scores it on the validation year, and the evaluation shows the validation error and whether it improved on the best so far.
3. **Given** the model says it is finished, **Then** the loop ends.
4. **Given** two rounds in a row with no improvement, **Then** the loop ends.
5. **Given** the cap of about six rounds is reached, **Then** the loop ends.
6. **Given** each new proposal, **Then** the model was given the feature catalogue, the explore statistics and the history of attempts with their validation errors, and nothing from the test year.
7. **Given** the graph on the page, **Then** the language-model step is visibly marked as such and looks different from the code steps, and the new nodes and loops are drawn.

---

### User Story 2 - The code keeps the language model honest (Priority: P1)

The language model may only choose features from the catalogue. Code checks every proposal. A proposal naming anything outside the catalogue, an empty set, or a set already tried is rejected by code, shown as a rejected step with the reason, and counts towards the cap. The model never produces numbers that appear as results; every error, coefficient and prediction comes from code.

**Why this priority**: The teaching point depends on separating the model's judgement from the code's arithmetic.

**Independent Test**: Feed a stand-in model each kind of bad proposal and check it is rejected, shown with its reason, and counted.

**Acceptance Scenarios**:

1. **Given** a proposal containing a name not in the catalogue, **Then** it is rejected, shown as a rejected step with the reason, and counts towards the cap.
2. **Given** an empty proposal, **Then** the same.
3. **Given** a proposal identical to a set already tried (in any order), **Then** the same.
2a. **Given** a proposal with more than 8 features, **Then** it is rejected, shown as a rejected step whose reason states the limit of 8, and counts towards the cap.
3a. **Given** a proposal in which a feature is an exact combination of the others in the set (for example wickets in hand together with wickets lost, or runs at 10 overs together with powerplay runs and runs in overs 7 to 10), **Then** it is rejected, shown as a rejected step whose reason names the repeating features, and counts towards the cap.
4. **Given** a model reply that includes numbers (for example a claimed error), **Then** those numbers are never shown as results; every number shown comes from code.
5. **Given** any run, **Then** no feature set that was fitted contains a name outside the catalogue.

---

### User Story 3 - A mechanical rival, and a final fair test (Priority: P1)

In the same graph, a code-only forward selection adds whichever single feature most reduces validation error, repeating until nothing helps, so the visitor sees both approaches. Then, once, the language model's best set, forward selection's set and the broadcaster's projection are each scored on the test year. The final results compare those three errors, and the explanation says which approach won and by how much.

**Why this priority**: Without a rival, "did the language model's reasoning help?" has no answer.

**Independent Test**: Run with a stand-in model and check the three test-year errors, the winner and the explanation numbers against an independent calculation.

**Acceptance Scenarios**:

1. **Given** the validation year, **Then** forward selection picks features using the validation error only, skips any addition that would make a feature an exact combination of the others, and stops when no single addition helps or the set reaches 8 features.
2. **Given** the final step, **Then** the test year is scored exactly once for each of the three contenders, after all feature choices are made.
3. **Given** the final results, **Then** they show the three test-year errors side by side and name the winning approach (language model or forward selection) and the margin, and say whether the winner beat the broadcaster's projection.
4. **Given** the explanation, **Then** it describes the winning model in cricket terms as before, and every number in it comes from code.
5. **Given** a leaderboard, **Then** it builds up during the run with every attempt, its features, its validation error and who proposed it (the language model or the mechanical method).

---

### User Story 4 - A bigger pool of candidate features and three slices of data (Priority: P1)

The prepared innings data has roughly 15 to 20 candidate features per innings, all measured at the 10-over mark. Each has a plain-language description in a feature catalogue shown to the visitor and given to the language model. The data is split by calendar year into training (earliest years), validation (second most recent year) and test (most recent year). The Data tab shows the new columns with descriptions, the "Used for" column shows all three slices, and the CSV includes the new columns.

**Why this priority**: Feature selection is only meaningful with a real choice of features and an honest way to judge them.

**Independent Test**: Re-run data preparation, then check the catalogue, the columns, the three slices and that no candidate uses anything after 10 overs.

**Acceptance Scenarios**:

1. **Given** the prepared data, **Then** it has additional per-innings columns such as wickets lost in the powerplay, runs and wickets in overs 7 to 10, fours and sixes, dot balls faced, extras conceded and the current partnership, plus derived candidates such as wickets in hand and runs at 10 overs multiplied by wickets in hand, plus the competition dummies from feature 003.
2. **Given** any candidate, **Then** it uses only what had happened by the end of the 10th over.
3. **Given** the catalogue, **Then** every candidate has a plain-language description, and the catalogue is visible to the visitor.
4. **Given** the Data tab, **Then** the new columns appear with friendly headings and descriptions, sort and filter like existing columns, and are in both CSV downloads.
5. **Given** the "Used for" column, **Then** every row shows Training, Validation or Test, and the filter offers all three; the latest calendar year is Test, the one before it is Validation, earlier years are Training.
6. **Given** the data summary and the agent's own steps, **Then** the row counts of the three slices agree everywhere.

---

### User Story 5 - Choose which language model does the proposing (Priority: P2)

Before pressing Play, the visitor picks a language model from a short list on the page. Each entry shows a friendly name and a one-line note (for example "fast" or "more thorough"). One is the default, so Play works without choosing. The list is set by the site owner. The model used is shown with the run's results.

**Why this priority**: Letting visitors compare models is part of the teaching, but a default run works without it.

**Independent Test**: Choose each listed model, and send a request for an unlisted one.

**Acceptance Scenarios**:

1. **Given** the page, **Then** a short list of models is shown, each with a friendly name and a one-line note, with one preselected.
2. **Given** Play without choosing, **Then** the default is used.
3. **Given** a run, **Then** the results show which model was used.
4. **Given** a run in progress, **When** the visitor changes the selection, **Then** the run is unaffected and the change applies to the next run.
5. **Given** a request that names a model not on the owner's list (including one made by altering the request), **Then** the app refuses it and calls no model outside the list.
6. **Given** a chosen model that is no longer available, **Then** the visitor is told and offered the default.
7. **Given** any page, response or event, **Then** the owner's key never appears.

---

### User Story 6 - Protect the site owner's account (Priority: P2)

Runs call a paid service, so the app limits how often one visitor can start a run, caps total runs per day, caps the length of each language-model reply and the number of calls per run, and allows only one run at a time per visitor. When a limit is reached, the visitor sees a clear message that says when to try again.

**Why this priority**: Without limits, a public page could run up a cost.

**Independent Test**: Exceed each limit in turn and read the message.

**Acceptance Scenarios**:

1. **Given** a visitor who starts runs too often, **Then** the next start is refused with a message saying when they can try again.
2. **Given** the daily total is reached, **Then** every new start is refused with a message saying when to try again, and no model is called.
3. **Given** a run in progress, **Then** the Play and Reset controls are disabled until it ends (Back and Step still replay what was received); **given** a run already in progress for the same visitor, **when** another start arrives anyway (for example from a second tab or an altered request), **then** it is refused with a clear message.
4. **Given** one run, **Then** the number of language-model calls does not exceed the per-run cap and each reply is cut off at the length cap.
5. **Given** a refused start, **Then** no language-model call is made and no earlier results on the page are lost.

---

### User Story 7 - Graceful failure when the model misbehaves (Priority: P2)

If the language model is unavailable, times out or returns something unusable, the step shows a clear failure, the run continues with forward selection only, and the results say plainly that the language model did not take part. If the connection drops mid-run, the steps received so far stay viewable, as today.

**Why this priority**: A live service will fail sometimes, and the visitor should still get a complete, honest run.

**Independent Test**: Make a stand-in model fail in each way and check the run completes with forward selection.

**Acceptance Scenarios**:

1. **Given** the model is unavailable, times out, or returns an unusable reply on the first round, **Then** the step shows a clear failure, forward selection still runs, the final test compares forward selection with the broadcaster's projection, and the results state that the language model did not take part.
2. **Given** a failure after some rounds, **Then** the language model's best set so far is kept for comparison and the failure is shown.
3. **Given** the connection drops mid-run, **Then** the steps received remain viewable and the page says the connection was lost.

---

### User Story 8 - Try my own innings, and read an up-to-date intro (Priority: P3)

The "Try your own innings" form asks for the inputs the winning model needs, and predicts from them. The home page intro says the agent now uses a language model to decide what to try next and that the numbers still come from code. A short note says runs can differ each time because a language model is involved, and that this is expected.

**Why this priority**: It keeps the existing interactive part consistent with the new model, and sets expectations.

**Independent Test**: Finish a run and use the form; read the intro and the note.

**Acceptance Scenarios**:

1. **Given** a finished run, **Then** the form shows exactly the inputs the winning model needs (derived values such as wickets in hand are worked out for the visitor, not asked for), and invalid input shows a message and no prediction.
2. **Given** the page, **Then** the intro mentions the language-model step and that numbers come from code, and a note says results can differ between runs.

---

### Edge Cases

- The language model proposes the same set twice, in a different order: rejected as already tried.
- A proposal of nine or more features is rejected as too large (the limit is 8); the model is told the limit with every request.
- A proposal that includes both a feature and an exact copy or complement of it (wickets in hand with wickets lost), or the parts and the total (powerplay runs, runs in overs 7 to 10 and runs at 10 overs): rejected as redundant, with the reason shown; the model sees the rejection in its history.
- The model proposes a feature name with different capitalisation or a near match: rejected (names must match the catalogue exactly).
- The model's reply cannot be understood, or has no usable proposal: treated as an unusable reply (failure handling), and the round counts towards the cap.
- The model says it is finished before any proposal has been fitted: handled as an unusable first round, so forward selection still gives a result.
- A candidate has a missing value for some innings: such innings are handled consistently (the data preparation guarantees values for all candidates, or the innings is not kept).
- The validation or test year has too few innings: the run stops at the load step with a clear data error, as with other unusable data.
- Forward selection finds nothing that helps even a single feature: its set is the best single feature found, and the results say so.
- The language model's best set is worse than forward selection's: forward selection wins and the results say so, with the margin.
- The winner does not beat the broadcaster's projection: the results say so plainly.
- The daily cap is reached while a run is in progress: that run completes; new starts are refused.
- Two tabs from the same visitor press Play at once: one is refused (one run at a time). Pressing Play during a run is not possible (the control is disabled), so "Play again starts clean" from feature 001 no longer applies.
- The selected model list entry is removed by the owner between page load and Play: the visitor is told and offered the default.
- The visitor tries to press Play during a run: Play and Reset are disabled while a run is in progress; a second start that gets through anyway (another tab, an altered request) is refused with a clear message and no model is called. Back and Step still replay the steps received.

## Requirements *(mandatory)*

### Functional Requirements

**Candidate features and data**

- **FR-001**: The prepared innings data MUST include roughly 15 to 20 candidate features per innings, each measured at the 10-over mark from the ball-by-ball data, including wickets lost in the powerplay, runs and wickets in overs 7 to 10, fours and sixes hit, dot balls faced, extras conceded and the current partnership.
- **FR-002**: The candidates MUST also include derived features such as wickets in hand and runs at 10 overs multiplied by wickets in hand, and the competition dummies from feature 003.
- **FR-003**: No candidate MAY use anything that happened after the 10-over mark.
- **FR-004**: Every candidate MUST have a plain-language description in a feature catalogue, which MUST be shown to the visitor and given to the language model.
- **FR-005**: The new columns MUST appear on the Data tab with friendly headings and descriptions, sort and filter like the existing columns, and be included in the CSV downloads (all rows and rows shown).
- **FR-006**: The data MUST be split by calendar year into training (earliest years), validation (the second most recent year) and test (the most recent year); the "Used for" column and its filter MUST show all three, and the three slices' row counts MUST agree across the Data tab, its summary and the agent's own steps.
- **FR-007**: The new columns MUST be created by the data preparation script from the ball-by-ball data, never added by hand or calculated later by the app, and the manifest MUST describe them.

**The agent**

- **FR-008**: The agent MUST include a language-model step, `propose_features`, that, given the feature catalogue, the explore statistics and the history of attempts with their validation errors, returns the next feature set to try with a one- or two-sentence reason in cricket language, and may say it is finished.
- **FR-009**: Code MUST fit each proposed set on the training years and score it on the validation year.
- **FR-010**: The propose, fit and evaluate loop MUST end when the model says it is finished, or two rounds in a row bring no improvement, or the fixed cap of about six rounds is reached.
- **FR-011**: The agent MUST include a code-only forward selection step that adds whichever single feature most reduces validation error, repeating until nothing helps or the set has 8 features (and skipping any addition that would create a repetition), in the same graph so both approaches are visible.
- **FR-012**: A final step MUST score the language model's best set, forward selection's set and the broadcaster's projection exactly once each on the test year, after all feature choices are made.
- **FR-013**: The explanation MUST describe the winning model as today, state which approach won (language model or forward selection) and by how much, and say whether the winner beat the broadcaster's projection.
- **FR-014**: The test year MUST play no part in choosing features, and no test-year result MAY be given to the language model.

**Rules for the language model**

- **FR-015**: The language model MAY only choose features from the catalogue. A proposal naming anything else, an empty set, a set already tried (in any order), a set of more than 8 features, or a set in which any feature is an exact combination of the others MUST be rejected by code, shown as a rejected step with the reason (naming the repeating features), and count towards the cap. Forward selection MUST NOT add a feature that would create such a repetition. This guarantees every fitted model has a single, meaningful set of coefficients.
- **FR-016**: Every number shown as a result (errors, coefficients, predictions) MUST come from code; numbers in a model reply MUST NOT be shown as results.
- **FR-017**: The model's reason MUST be shown to the visitor exactly as given, clearly labelled as the model's reasoning.
- **FR-018**: Explore statistics and anything else given to the model MUST be computed without the test year.

**Choosing the model**

- **FR-019**: The page MUST let the visitor pick, before Play, a language model from a short list, each with a friendly name and a one-line note, with one model as the default.
- **FR-020**: The list MUST be set by the site owner. The app MUST refuse any request for a model that is not on it, and MUST NOT call a model outside the list.
- **FR-021**: The results MUST show which model was used. Changing the selection MUST NOT affect a run in progress.
- **FR-022**: If the chosen model is no longer available, the visitor MUST be told and offered the default.
- **FR-023**: The site owner's key MUST NOT be sent to the browser or appear anywhere on the page, in responses, or in events.

**What the visitor sees**

- **FR-024**: The graph MUST show the new nodes and loops, with `propose_features` visibly marked as the language-model step and different from the code steps.
- **FR-025**: Each proposal's event MUST show the chosen features and the model's reason; each evaluation MUST show the validation error and whether it improved.
- **FR-026**: A leaderboard MUST build up during the run with every attempt, its features, its validation error and who proposed it (the language model or the mechanical method).
- **FR-027**: The final results MUST compare the three test-year errors: the language model's choice, forward selection and the broadcaster's projection.
- **FR-028**: The page MUST include a short note that runs can differ each time because a language model is involved, and that this is expected.
- **FR-029**: The home page intro MUST say the agent now uses a language model to decide what to try and that the numbers still come from code.
- **FR-030**: The "Try your own innings" form MUST ask for the inputs the winning model needs (working out derived values for the visitor) and show a message for invalid input.

**Protecting the owner's account**

- **FR-031**: The app MUST limit how often one visitor can start a run, cap total runs per day, and allow only one run at a time per visitor (Play is disabled while a run is in progress, and a second start from the same visitor is refused); when a limit is reached it MUST show a clear message saying when to try again, and MUST NOT call a language model for a refused start.
- **FR-032**: The app MUST cap the length of each language-model reply and the number of language-model calls per run.

**When things go wrong**

- **FR-033**: If the language model is unavailable, times out or returns something unusable, the step MUST show a clear failure, the run MUST continue with forward selection only, and the results MUST say plainly that the language model did not take part.
- **FR-034**: If the connection drops mid-run, received steps MUST remain viewable, as today.

**Testing**

- **FR-035**: Automated tests MUST be repeatable and MUST NOT call a real language model.

### Key Entities

- **Candidate feature**: a per-innings measurement or derived value, available at the 10-over mark, with an id and a plain-language description.
- **Feature catalogue**: the list of candidates and their descriptions, shown to the visitor and given to the language model; the only features a proposal may name.
- **Slice**: training, validation or test, defined by calendar year.
- **Attempt**: a feature set that was fitted, with its validation error, who proposed it, and whether it improved.
- **Proposal**: the language model's suggested set and its reason, or a rejection with the reason.
- **Leaderboard entry**: an attempt as shown to the visitor.
- **Model option**: a language model the owner allows, with a friendly name, a one-line note and a default flag.
- **Run limits**: per-visitor rate, one-at-a-time, daily total, reply length and calls per run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every number in the results and explanation comes from code, for every run.
- **SC-002**: Across all runs, no fitted feature set contains a feature outside the catalogue.
- **SC-003**: The test year plays no part in choosing features: changing the test year's values changes no proposal input, no attempt and no chosen set.
- **SC-004**: A run with the default model completes in about a minute or less: typically under 60 seconds, with a hard stop at 80 seconds.
- **SC-005**: A visitor can tell from the page which model ran, what it proposed each round and why, and whether it beat forward selection.
- **SC-006**: A visitor cannot make the app call a model outside the owner's list, and cannot obtain the key (checked by trying altered requests and searching every response).
- **SC-007**: Hitting each limit (rate, one at a time, daily total) gives a clear message with when to try again, and makes no model call.
- **SC-008**: When the language model fails, the run still completes with forward selection and says plainly that the model did not take part.
- **SC-009**: The three slices' row counts agree on the Data tab, its summary and the agent's steps (100% agreement).
- **SC-010**: All automated tests run without a real language model and give the same results on every run.

## Assumptions

- Language-model calls go through the site owner's account with OpenRouter, using a key held only on the server.
- Because a language model is involved, runs are intentionally not identical each time. Feature 003's "the agent's run is unchanged" guarantee applied to that feature only and is superseded here; the agent's old fixed three-feature loop is replaced by this one.
- A "visitor" for rate limiting has no account and is identified by their network address.
- Default limits, adjustable by the owner without changing the page: no more than 5 run starts per visitor per hour, at most 300 run starts per day in total, one run at a time per visitor, a reply length cap of a few hundred words, and a per-run call cap equal to the round cap plus a small allowance.
- The set-size limit is 8 features, for both the language model's proposals and forward selection; it keeps the leaderboard, the explanation and the "Try your own innings" form short.
- The round cap is six; "no improvement" means the validation error did not fall below the best so far.
- "Won" means the lowest test-year error between the language model's best set and forward selection's set; the broadcaster's projection is the benchmark both are compared to, and the existing rule for beating it (a set margin of average error) still applies.
- The explore statistics given to the language model come from the training years only.
- The validation and test years each need enough innings to be fair; if either has too few, the run stops with a clear data error (the existing minimum applies to both).
- The candidate columns are produced by re-running the data preparation script on fresh Cricsheet ball-by-ball data, so the data's download date changes.
- The "Try your own innings" form asks for base measurements; derived candidates (wickets in hand, products) are worked out from them.
- The owner's list of allowed models, the default model, and the limits live in server configuration, not in the page.

## Out of Scope

- The language model inventing new features or formulas beyond the catalogue.
- The language model writing the final explanation.
- Visitors supplying their own API key.
- Accounts, saved run history, and comparing several models in one run.
- Changing the competition dummies, the broadcaster's projection, or the Data tab's other features.
