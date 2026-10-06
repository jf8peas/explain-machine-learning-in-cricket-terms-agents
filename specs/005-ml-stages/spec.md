# Feature Specification: Machine Learning Stages on Every Step

**Feature Branch**: `005-ml-stages` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-06
**Status**: Draft
**Input**: Show which stage of machine learning each step of the agent belongs to, so a visitor can tell the stages apart at a glance in the graph and everywhere else a step appears.

## Context

This extends the linear regression agent app (features 001 to 004). The graph shows the agent's steps as nodes, but nothing tells a visitor what kind of work a step is doing: preparing data, fitting parameters, choosing the setup, or assessing the result.

The audience is cricket fans learning machine learning. Learning the stages of a modelling project, and seeing which step belongs to which, is one of the main things the site should teach. The same stages apply to all eight algorithm apps, so the stage names and how they are shown must be shared and reusable, and the graph visualiser must show them without knowing anything about cricket or linear regression.

### The eight stages

One fixed set, in this order. Each has a short name, a one-sentence plain-language description and the question it answers. (The wording of the descriptions is written in planning; the names and questions are fixed here.)

| # | Name | The question it answers |
|---|---|---|
| 1 | Frame the problem | What are we predicting, and what counts as good? |
| 2 | Prepare the data | Is the data clean and in a usable form? (cleansing and creating features) |
| 3 | Understand the data | What patterns are there? |
| 4 | Split the data | What do we learn from, choose with, and mark on? |
| 5 | Fit the model | What are the best parameters for this setup? (parameter optimisation) |
| 6 | Choose the setup | Which features, model type and hyperparameters? (feature selection and hyperparameter tuning) |
| 7 | Final assessment | How good is it on data it has never seen? |
| 8 | Interpret and communicate | What does it mean? |

### Which step belongs to which stage in this app

| Stage | Steps in this agent |
|---|---|
| 1 Frame the problem | `baseline` (the TV projection sets what "good" means: the score to beat) |
| 2 Prepare the data | `load_data`, and the work done beforehand by the data preparation script (shown separately, see below) |
| 3 Understand the data | `explore` |
| 4 Split the data | `split` |
| 5 Fit the model | `fit_model` |
| 6 Choose the setup | `propose_features`, `check_proposal`, `evaluate`, `forward_selection` |
| 7 Final assessment | `final_test` |
| 8 Interpret and communicate | `explain_in_cricket_terms` |

Every node in the graph today is listed, so no node needs an assignment beyond these. Any node added later must be given a stage when it is added (FR-003).

## Clarifications

### Session 2026-10-06

- Q: How should the fit-and-choose loop show on the graph? → A: The edges between Fit the model and the Choose the setup steps look like any other edge before a run; once the run has gone round the loop they are drawn emphasised and show a "round N" count that goes up each time the agent returns to Fit the model. Static styling, no animation.
- Q: What is the second cue on each node? → A: A small numbered badge (1 to 8) matching the legend's order; the legend and the group bands also show the stage name. The timeline entries carry the same number badge.
- Q: How should grouping work when a stage's nodes aren't next to each other? → A: One band for each run of neighbouring nodes in the same stage, each labelled with the stage name and number. A stage can have several bands (here, stage 6 has more than one because Fit the model sits between its steps), and a band never encloses a node of another stage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See each step's stage at a glance in the graph (Priority: P1)

A visitor looks at the graph and can tell, for every node, which of the eight stages it belongs to, without reading the step's details, and still sees whether the step is active or visited, how many times it ran, and whether it is a language-model step.

**Why this priority**: This is the point of the feature; the legend and the other places build on it.

**Independent Test**: Load the graph with no run and check every node shows its stage with a colour and a second cue; run the agent and check the run states and the language-model marking are still readable on every node.

**Acceptance Scenarios**:

1. **Given** the graph before any run, **Then** each node shows its stage through a consistent colour for that stage and a second cue that does not depend on colour (a short label, number or icon), in both light and dark mode.
2. **Given** nodes of the same stage, **Then** each run of neighbouring nodes in a stage is grouped in a band labelled with the stage's name and number; a stage whose nodes are not all neighbours has more than one band; a band never encloses a node of another stage, and never hides an edge or a node.
3. **Given** a run in progress, **Then** the active node, visited nodes and visit counts are still clearly distinguishable on a node that also shows its stage.
4. **Given** the language-model step, **Then** a visitor can see at once both its stage (Choose the setup) and that it is a language-model step; the other steps in that stage show their stage and are marked as code steps in the existing way.

---

### User Story 2 - A legend that explains the stages and lets me focus on one (Priority: P1)

Beside the graph, a legend lists the eight stages in order with each one's colour, cue, name and question. Selecting a stage highlights its nodes and dims the rest.

**Why this priority**: The colours and cues mean nothing until they are explained, and focusing on one stage is the quickest way to see what belongs to it.

**Independent Test**: Select each stage by mouse, by touch and by keyboard and check the highlight, the dimming and the clearing; do it during a run and check the run is not interrupted.

**Acceptance Scenarios**:

1. **Given** the graph page, **Then** the legend shows all eight stages in order with colour, cue, name and question.
2. **Given** the legend, **When** the visitor selects a stage, **Then** that stage's nodes are highlighted and the other nodes are dimmed; **when** they select it again, or select "All", **then** the highlight clears.
3. **Given** a selection made by mouse, by touch or by keyboard alone, **Then** each works, the selected stage is announced to assistive technology, and keyboard focus is visible.
4. **Given** a run in progress, **When** the visitor selects or clears a stage, **Then** the run is not interrupted and keeps playing; **given** a stage is highlighted while the active step is in another stage, **then** the active step stays clearly visible (dimmed nodes are dimmed, not hidden).
5. **Given** a stage with no node in the current app (every stage has a node in this app, but another app's graph may leave one empty), **then** it still appears in the legend marked "not a step in this agent" with a one-line reason.

---

### User Story 3 - The stage appears wherever a step appears (Priority: P1)

The step detail panel and the timeline of the path taken show each step's stage, so the visitor sees the run move between stages, including the repeated move between Fit the model and Choose the setup.

**Why this priority**: Learning the stages means seeing the run walk through them, not only a static picture.

**Independent Test**: Play a run and check each timeline entry and the detail panel against the graph for every step.

**Acceptance Scenarios**:

1. **Given** the current step, **Then** the detail panel shows its stage name and the stage's question.
2. **Given** the timeline of the path taken, **Then** each entry carries its stage cue, so the visitor can see the run moving between stages.
3. **Given** any step, **Then** the stage shown in the graph, the detail panel and the timeline is the same stage.
4. **Given** the leaderboard and the results, **Then** they are unchanged by this feature.

---

### User Story 4 - Work done before the agent runs is visible too (Priority: P2)

Cleaning the data and creating features happen in the data preparation script, before the agent starts. The graph shows this as a clearly different "done beforehand" item ahead of `load_data`, in the Prepare the data stage, so the visitor understands that the agent did not do that work.

**Why this priority**: It completes the Prepare the data stage honestly and reinforces what the Data tab already says; the feature works without it.

**Independent Test**: Load the page, check the item is drawn differently, run the agent and check it never becomes active, then select it and read the summary and follow the link.

**Acceptance Scenarios**:

1. **Given** the graph, **Then** an item labelled as done beforehand appears ahead of `load_data`, in the Prepare the data stage, drawn in a clearly different way from a step the agent runs.
2. **Given** a run, **Then** this item never becomes active, is never visited, is not counted as a step and does not appear in the timeline.
3. **Given** the item, **When** the visitor selects it (by mouse, touch or keyboard), **Then** a short summary shows what was done beforehand (what was excluded and why, and which columns were created) with a link to the Data tab.
4. **Given** the summary, **Then** its figures come from the prepared data's own record of what was done, not from text typed into the page.

---

### User Story 5 - Understand the inner and outer loop (Priority: P2)

Near the legend, a short explanation in cricket-friendly plain language says that every time the agent tries a new setup (stage 6) it fits the model again (stage 5); that parameters are learned from the training years, the setup is chosen using the validation year, and the test year is used once at the end. When the run loops between these two stages, the graph makes the loop easy to see.

**Why this priority**: The loop between fitting and choosing is the most confusing idea for newcomers and the one this agent shows best.

**Independent Test**: Run the agent and watch the loop between Fit the model and Choose the setup; read the explanation and check it matches what the run did.

**Acceptance Scenarios**:

1. **Given** the page, **Then** the explanation is near the legend, is short, and says that parameters are learned from the training years, the setup is chosen using the validation year, and the test year is used once at the end.
2. **Given** the explanation, **Then** the years it mentions are the ones this app actually uses (read from the data, not typed in), and it says plainly that in this app "Choose the setup" means feature selection only, because plain linear regression has no hyperparameters and hyperparameter tuning appears in later apps.
3. **Given** a run that goes round the fit and choose loop, **Then** once it has done so the edges between Fit the model and the Choose the setup steps are drawn emphasised with a "round N" count that rises each time the agent returns to Fit the model (before then they look like any other edge), without relying on animation; **given** the visitor steps back or resets, **then** the count follows the replay.

---

### User Story 6 - Reuse for the other apps (Priority: P2)

A second app with a different graph gets the legend, the highlighting, the grouping and the timeline cues with no changes to the visualiser. A node with no stage is caught before it ships.

**Why this priority**: The same stages apply to all eight apps; the feature is only worth building once if it is shared.

**Independent Test**: Show an unrelated graph with its own stage assignments in the visualiser with no code change; remove a stage from a node and check the automated check fails.

**Acceptance Scenarios**:

1. **Given** an unrelated second graph that names a stage for each node, **Then** the visualiser shows the colours, cues, grouping, legend, highlighting and timeline cues for it, with no change to the visualiser.
2. **Given** the visualiser, **Then** it contains no knowledge of cricket or linear regression; the stage names, order, descriptions, colours and cues come from one shared stage set that is the same for every app.
3. **Given** a node with no stage, **Then** it is drawn in a neutral style and flagged in the legend as unassigned, and an automated check fails so it cannot ship that way.

---

### Edge Cases

- A node with no stage assigned: neutral style, "unassigned" in the legend, and a failing automated check (US6).
- A node naming a stage that is not one of the eight: treated like an unassigned node.
- A narrow phone screen: the legend collapses to a compact form and stays usable; the cues on nodes stay legible; selecting a stage still works by touch.
- Reduced motion: highlighting, dimming, grouping and the loop emphasis do not rely on animation.
- A stage is highlighted while the active step is in another stage: the active step stays clearly visible.
- A stage whose nodes are split by a node of another stage: it gets one band for each run of neighbours, never one band across the other stage's node.
- A stage with no node in an app: still listed in the legend, marked "not a step in this agent", with a one-line reason.
- Colour-blind visitors and both colour themes: stages are told apart by the second cue even if the colours look alike.
- The visitor selects a stage, then presses Play, steps or goes back: the highlight stays until cleared and does not disturb playback.
- The visitor selects the done-beforehand item during a run: the summary opens and the run is not interrupted.
- The prepared data's record of what was done is missing or unreadable: the done-beforehand item still appears and says its details could not be loaded, with the link to the Data tab.

## Requirements *(mandatory)*

### Functional Requirements

**The stage set**

- **FR-001**: There is one fixed set of eight stages in the order given in Context, each with a short name, a one-sentence plain-language description, the question it answers, a colour and a second, colour-independent cue, which is the stage's number (1 to 8) shown as a small badge. The set is defined once and is the same for every algorithm app.
- **FR-002**: Every node in the graph belongs to exactly one stage. A node's stage is defined once, alongside the node, and the graph, the legend, the detail panel and the timeline all read it from there.
- **FR-003**: A node with no stage, or with a stage that is not in the set, is drawn in a neutral style and flagged as unassigned in the legend, and an automated check fails when any node of any app's graph is unassigned.
- **FR-004**: The stage of each of this app's nodes is as given in Context. A node that exists but is not listed there must be assigned during planning and flagged.

**In the graph**

- **FR-005**: Each node shows its stage with the stage's colour and its number badge (1 to 8, matching the legend's order), readable in light and dark mode and without relying on colour.
- **FR-006**: Each run of neighbouring nodes in the same stage is grouped in a band labelled with the stage's name and number. A stage whose nodes are not all neighbours (here, Choose the setup, with Fit the model between its steps) has more than one band. A band never encloses a node of another stage or an unassigned node, and never hides a node or an edge. The start and end markers are not steps, so a band may surround them.
- **FR-007**: Stage styling does not hide the existing run states (active, visited, visit count) or the existing marking of language-model steps; a visitor can see both a node's stage and whether it is a language-model or code step.
- **FR-008**: Before a run, the edges between Fit the model and the Choose the setup steps look like any other edge. Once a run has gone round that loop, those edges are drawn emphasised and show a "round N" count that goes up by one each time the agent returns to Fit the model. This is static styling and does not rely on animation, and it follows the replay: stepping back lowers the count and Reset clears it.

**The legend**

- **FR-009**: A legend beside the graph lists the eight stages in order with colour, cue, name and question.
- **FR-010**: Selecting a stage in the legend highlights that stage's nodes and bands and dims the other stages' nodes and bands (edges are left as they are); selecting it again, or selecting "All", clears the highlight. This works by mouse, touch and keyboard, announces the selected stage to assistive technology, shows visible keyboard focus, and does not interrupt a run in progress.
- **FR-011**: A stage with no node in the current app still appears in the legend, marked "not a step in this agent", with a one-line reason.
- **FR-012**: A highlighted stage never hides the active step: the active step stays clearly visible whatever is highlighted.
- **FR-013**: On a narrow phone screen the legend collapses to a compact form that remains usable.

**Everywhere else a step appears**

- **FR-014**: The step detail panel shows the current step's stage name and question.
- **FR-015**: Each entry in the timeline of the path taken carries its stage's number badge.
- **FR-016**: The stage shown for a step is the same in the graph, the detail panel and the timeline.
- **FR-017**: The leaderboard and the results are unchanged.

**Work done before the agent runs**

- **FR-018**: The graph shows the data preparation script's work (cleansing and creating features) as a clearly different "done beforehand" item ahead of `load_data`, in the Prepare the data stage. It never becomes active, is never counted as a run step and does not appear in the timeline.
- **FR-019**: Selecting that item (by mouse, touch or keyboard) shows a short summary of what was done (what was excluded and why, and which columns were created) with a link to the Data tab. The summary's figures come from the prepared data's own record, not from text typed into the page. If that record cannot be read, the item says so and still links to the Data tab.

**The two loops, and what this app does not do**

- **FR-020**: Near the legend, a short explanation in cricket-friendly plain language says that every time the agent tries a new setup (stage 6) it fits the model again (stage 5), that parameters are learned from the training years, the setup is chosen using the validation year, and the test year is used once at the end. The years named come from the data, not from typed text.
- **FR-021**: The Choose the setup stage states plainly that in this app it means feature selection only, because plain linear regression has no hyperparameters, and that hyperparameter tuning appears in later apps.

**Reuse**

- **FR-022**: The graph visualiser shows stages generically from each node's stage and the shared stage set, with no knowledge of cricket or linear regression. Another app with a different graph gets the legend, highlighting, grouping, loop emphasis and timeline cues with no change to the visualiser. A test shows an unrelated second graph with its own stage assignments working unchanged.
- **FR-023**: All existing playback behaviour (Play, Pause, Step, Back, Reset, speed, timeline jumping, keyboard stepping) and all existing tests keep working.

### Key Entities

- **Stage**: one of eight in a fixed order, with a name, a one-sentence description, a question, a colour and a number badge (its position, 1 to 8). Defined once for all apps.
- **Stage assignment**: for each node, the one stage it belongs to, defined alongside the node.
- **Done-beforehand item**: a display-only item in Prepare the data that stands for the preparation script's work; it has a summary built from the prepared data's record and a link to the Data tab; it is not a step the agent runs.
- **Legend**: the ordered list of stages, the "All" choice, the current selection, and the notes for empty stages and unassigned nodes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor with no machine learning background, after one run, can name the stage of any step they are shown and say which stage fits parameters and which chooses the setup (judged by a person, as in feature 004's reader review).
- **SC-002**: Every node has exactly one stage, and the stage shown in the graph, the detail panel and the timeline agrees for every step of a run, checked automatically for every node.
- **SC-003**: The eight stages can be told apart without relying on colour, in both light and dark mode (checked by looking at the page with colour removed, and by an automated check that the eight number badges are all different and each stage has its own colour).
- **SC-004**: The same visualiser shows the stages correctly for a second, unrelated graph with no change to it, checked by an automated test.
- **SC-005**: Selecting or clearing a stage during a run never interrupts the run and never hides the active step, checked by an automated test.
- **SC-006**: A node with no stage makes the automated check fail.
- **SC-007**: All existing playback behaviour and all existing tests still pass.
- **SC-008**: On a phone-width screen the legend, the cues and the highlight all stay usable, with no horizontal scrolling of the page.

## Assumptions

- The data preparation script, and the prepared data's record of what it excluded and which columns it created, already exist from features 002 to 004; this feature reads that record and adds nothing to the script's work.
- The done-beforehand item is not an agent step, so adding it does not conflict with "no adding or removing agent steps" in Out of Scope. It does not change what any node does, the run's step sequence or its counts.
- The final wording of the stage descriptions and the colours are chosen during planning, subject to FR-001, FR-005 and SC-003. The second cue is the stage's number badge (see Clarifications).
- `baseline` sits in stage 1 because it sets the score to beat (what "good" means), even though it also runs on the validation year; this is the brief's assignment.
- The shared stage set lives where the other shared pieces live, so the other seven apps can use it; how it is shared is a planning decision.
- Selecting the done-beforehand item works by mouse, touch and keyboard, like the legend. It is the only node of the graph that can be selected.

- Choosing a stage in the legend is a viewing preference: it stays across Play, Pause, Step, Back, Reset and a new run until the visitor clears it.

## Out of Scope

- Changing what any node does, adding or removing agent steps, hyperparameter tuning itself, and changes to the Data tab beyond the link to it.
- Changes to the leaderboard or the results.
- Building the other seven algorithm apps; this feature only makes the stage set and the visualiser ready for them.
