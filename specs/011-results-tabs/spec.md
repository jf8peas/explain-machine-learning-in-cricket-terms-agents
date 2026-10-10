# Feature Specification: Results in Tabs That Follow the Process

**Feature Branch**: `011-results-tabs` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-10
**Status**: Draft
**Input**: Split the linear regression app's output into tabs that follow the order of the process, so the Working tab stays focused on watching the agent and each set of results is easier to take in.

## Context

This extends the linear regression agent app (features 001 to 008). The page has a Working tab and a Data tab. Under the graph on the Working tab all of the results are stacked: the leaderboard, the rival's grid search, the model's reasoning, the final test with its comparison table and chart, the explanation, and the try-your-own form. A visitor scrolls through all of it and the graph gets lost among the results.

The audience is cricket fans learning machine learning. Separating watching, results and playing makes each part easier to take in.

This feature moves existing results between tabs and adds navigation around them. It changes what no result shows and how none is calculated.

## Clarifications

### Session 2026-10-10

- Q: When does The final test tab become ready? → A: When the replay shows the final test step; Try your own innings becomes ready when the replay reaches its last step.
- Q: What counts as a failure for the switch? → A: A run that ends with an error from the server, or whose connection is lost before it finishes. The page stays on the tab it is on, and the message stays visible on the Working tab.
- Q: What happens to a tab's ready state when the visitor steps back? → A: The tab's marker, once shown, stays until the tab is opened; the tab's content and its "not ready" sentence follow the step on display, so stepping back before a tab's content exists shows its sentence again.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Working stays focused on watching (Priority: P1)

A visitor opens the page and sees the Working tab: the introduction, the model picker, the graph with its controls and a one-line summary beneath it. None of the results are stacked below. They press Play and watch.

**Why this priority**: The graph is the heart of the page and is currently buried; this is the main reason for the feature.

**Independent test**: Load the page with no run; the Working tab shows only the introduction, picker, graph, controls and summary line.

**Acceptance Scenarios**:

1. **Given** the page first loads, **Then** the Working tab is shown, although the Data tab is first in the tab order.
2. **Given** no run in progress, **Then** the Working tab contains the introduction, the model picker, the graph and its controls and the summary line, and none of the leaderboard, grid search, reasoning, final test, explanation or try-your-own content.
3. **Given** a run in progress, **Then** the summary line under the graph shows the best setup so far: its average miss, who proposed it (the language model or the rival), and a link to the What the agent found tab.
4. **Given** no run yet, **Then** the summary line says briefly that results will appear here and in the results tabs.

---

### User Story 2 - Five tabs in the order of the process (Priority: P1)

The page has five tabs, in this order: **Data**, **Working**, **What the agent found**, **The final test**, **Try your own innings**.

- **Data**: the existing Data tab, unchanged.
- **Working**: the introduction, the model picker, the graph and its controls, and the live summary.
- **What the agent found**: the leaderboard, the rival's grid search, and all of the language model's reasoning from the run, collected in order.
- **The final test**: everything from the final test downwards: the comparison of every method against actual totals, the predicted-versus-actual chart, the verdict, the explanation and the note that no method can be perfect.
- **Try your own innings**: the existing form and its result.

**Independent test**: Count the tabs and read their names and order; check each result that used to be on the page appears in exactly one tab.

**Acceptance Scenarios**:

1. **Given** the page, **Then** exactly five tabs exist, in the order above.
2. **Given** any result that appeared on the page before this feature, **Then** it appears in exactly one tab and nowhere else.
3. **Given** the Data tab, **Then** its contents are unchanged.

---

### User Story 3 - Tabs are links, and switching loses nothing (Priority: P1)

Each tab has its own link, so a tab can be shared or bookmarked. The browser's Back button moves between tabs, as the existing two tabs do. Opening the page with a tab's link opens that tab. Switching tabs never resets anything: a run in progress keeps playing, and every tab keeps its content, scroll position, inputs and selections.

**Acceptance Scenarios**:

1. **Given** a tab's link, **Then** opening it shows that tab.
2. **Given** the visitor moves between tabs, **Then** Back and Forward step through the tabs visited.
3. **Given** a run in progress, **When** the visitor switches tabs any number of times, **Then** the run is never restarted or paused by it.
4. **Given** inputs, selections and scroll positions in a tab, **When** the visitor leaves and returns, **Then** they are as they were left.

---

### User Story 4 - Moving to the results when the run finishes (Priority: P1)

When the replay of a run reaches its final step on screen, the page switches to the What the agent found tab, moves keyboard focus to that tab's heading and announces the change to screen readers. "Reaches its final step on screen" means the visitor has watched to the end, not that the server has finished sending steps: if the visitor pauses before the end, the switch waits until playback reaches the end.

This happens once per run. Stepping back and forward afterwards, or replaying from the timeline, does not switch tabs again. If the run ends in a failure (for example the data could not be loaded), the page does not switch tabs, and the failure stays visible on the Working tab.

**Acceptance Scenarios**:

1. **Given** a run, **When** the replay reaches its final step, **Then** the What the agent found tab is shown, its heading has keyboard focus, and a screen reader is told of the change.
2. **Given** the visitor pauses before the end, **Then** the switch waits until playback reaches the end.
3. **Given** the switch has happened, **When** the visitor steps back and forward or replays from the timeline, **Then** no further switch happens for that run.
4. **Given** a run that fails (an error from the server, or a connection lost before the run finishes), **Then** no switch happens and the failure remains visible on the Working tab.
5. **Given** the visitor is on the Data tab or any other tab when the replay reaches its end, **Then** the page still switches to What the agent found.

---

### User Story 5 - Tabs that are not ready yet (Priority: P2)

Until its content is ready, What the agent found, The final test and Try your own innings each show one short sentence saying what will appear there after a run, with a link back to the Working tab. They can still be opened. During a run, What the agent found fills in as steps are shown, as the leaderboard does today. When a tab's content becomes ready, its tab shows a small marker that does not rely on colour alone, and the marker clears when the visitor opens that tab. When a run finishes, What the agent found offers a clear link to The final test.

**Acceptance Scenarios**:

1. **Given** a result tab whose content is not ready, **Then** it shows one sentence and a link to Working, and can be opened. What the agent found is ready from the first step that adds to it; The final test is ready when the replay shows the final test step; Try your own innings is ready when the replay reaches its last step.
2. **Given** a run in progress, **Then** What the agent found fills in as steps are shown.
3. **Given** a tab's content becomes ready, **Then** its tab carries a marker with a non-colour cue; opening the tab clears it.
4. **Given** a finished run, **Then** What the agent found has a clear link to The final test.
5. **Given** the page is opened directly at The final test's link before any run, **Then** it shows the "not ready" sentence and the link to Working.
6. **Given** a result tab was ready and the visitor steps back to a step before its content exists, **Then** its "not ready" sentence shows again, and its marker (if not yet opened) stays.

---

### User Story 6 - Everyone can use the tabs (Priority: P2)

The tabs work by keyboard and are announced correctly to screen readers. On a narrow phone screen the tab bar stays usable without the page scrolling sideways (for example by scrolling within the bar or wrapping). Switching tabs and the ready markers do not rely on animation.

**Acceptance Scenarios**:

1. **Given** a keyboard user, **Then** every tab can be reached and opened without a mouse.
2. **Given** a screen reader, **Then** each tab, the selected tab and the change on switching are announced.
3. **Given** a phone-width screen, **Then** all five tabs are reachable and the page does not scroll sideways.
4. **Given** reduced motion is requested, **Then** nothing about switching or markers animates.

### Edge Cases

- A new run starts while the visitor is on a results tab: the results tabs return to their "not ready" state, the visitor stays where they are, and the switch to What the agent found happens again when the new run's replay reaches its end.
- The language model did not take part: What the agent found shows the rival's results and says the language model was absent; the other tabs behave as feature 004 describes.
- The visitor opens a results tab's link while a run is in progress: the tab shows what is ready so far, or its "not ready" sentence if nothing is ready yet.
- The visitor reaches the end of the replay while on Try your own innings or Data: the switch still happens; any typed input there is kept.
- Two runs in quick succession: only the run now on screen can cause a switch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST have five tabs in this order: Data, Working, What the agent found, The final test, Try your own innings.
- **FR-002**: On first load the Working tab MUST be shown, whatever the tab order.
- **FR-003**: The Data tab's contents MUST be unchanged.
- **FR-004**: The Working tab MUST contain the introduction, the model picker, the graph and its controls, and a live summary, and no other results.
- **FR-005**: What the agent found MUST contain the leaderboard, the rival's grid search, and all of the language model's reasoning from the run, in order.
- **FR-006**: The final test MUST contain everything from the final test downwards: the comparison of every method against actual totals, the predicted-versus-actual chart, the verdict, the explanation and the note that no method can be perfect.
- **FR-007**: Try your own innings MUST contain the existing form and its result.
- **FR-008**: Every result that appeared on the page before MUST appear in exactly one tab, with its content and calculation unchanged.
- **FR-009**: Each tab MUST have its own link; opening the page with a tab's link MUST open that tab; Back and Forward MUST move between tabs visited.
- **FR-010**: Switching tabs MUST NOT restart or pause a run, nor reset any tab's content, scroll position, inputs or selections.
- **FR-011**: Under the graph, a one-line summary MUST show, during a run, the best setup so far (its average miss, who proposed it, and a link to What the agent found); before any run it MUST say briefly that results will appear here and in the results tabs.
- **FR-012**: When the replay of a run reaches its final step on screen, the page MUST switch to What the agent found, move keyboard focus to that tab's heading and announce the change to screen readers; if the visitor pauses before the end the switch MUST wait until playback reaches the end.
- **FR-013**: The switch MUST happen once per run, not again on stepping back and forward or replaying from the timeline, and MUST happen whichever tab the visitor is on.
- **FR-014**: If a run ends in a failure (an error from the server, or a connection lost before the run finishes), the page MUST NOT switch tabs and the failure MUST stay visible on the Working tab.
- **FR-015**: Until its content is ready, each of the three result tabs MUST show one short sentence saying what will appear there after a run, with a link back to Working, and MUST still be openable. Readiness follows the replay on screen, not the server: What the agent found is ready from the first step that adds to it, The final test when the replay shows the final test step, and Try your own innings when the replay reaches its last step.
- **FR-016**: During a run, What the agent found MUST fill in as steps are shown.
- **FR-017**: When a tab's content becomes ready its tab MUST show a small marker that does not rely on colour alone; the marker MUST clear when that tab is opened.
- **FR-018**: Once The final test is ready, What the agent found MUST offer a clear link to The final test.
- **FR-019**: A new run starting MUST return the results tabs to their "not ready" state, leave the visitor where they are, and re-arm the switch for that run's end.
- **FR-020**: If the language model did not take part, What the agent found MUST show the rival's results and say the language model was absent; other tabs behave as feature 004 describes.
- **FR-021**: The tabs MUST be operable by keyboard and announced correctly to screen readers; at phone width the tab bar MUST be usable without the page scrolling sideways.
- **FR-022**: Switching tabs and the ready markers MUST NOT rely on animation.
- **FR-024**: A tab's marker, once shown, MUST stay until that tab is opened, even if the visitor steps back; the content and the "not ready" sentence MUST follow the step on display.
- **FR-023**: A tab's link opened before any run MUST show the "not ready" sentence and the link to Working (for The final test and the other result tabs).

### Key Entities

- **Tab**: one of five named sections with its own link, a heading, a ready marker and a not-ready sentence (result tabs).
- **Run readiness**: for each result tab, whether its content is ready (not started, filling in, finished); resets with each new run.
- **Summary line**: the one-line best-so-far shown under the graph.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first load the Working tab is shown, and the Data tab is first in the tab order.
- **SC-002**: With no run in progress, the Working tab shows the introduction, the model picker, the graph and the summary line, and none of the other results.
- **SC-003**: When the replay reaches the final step, the What the agent found tab is shown and has keyboard focus, every time and only once per run.
- **SC-004**: Switching tabs any number of times during or after a run never restarts the run or loses content, inputs or selections.
- **SC-005**: Every result that appeared on the page before this feature still appears, in exactly one tab.
- **SC-006**: Every tab can be reached by its link and by keyboard, and the page never scrolls sideways at phone width.
- **SC-007**: All existing tests still pass, updated only where they expected results on the Working tab.

## Assumptions

- The existing Working and Data tabs already have links and Back/Forward behaviour through the page's tab component; the three new tabs follow the same behaviour, and the page keeps one tab component.
- The tab titles are the exact names given; their links are `#data`, `#working`, `#found`, `#final-test` and `#try-your-own`.
- "Best setup so far" in the summary is the same figure the leaderboard shows as leading at that moment; no new calculation is introduced.
- "All of the language model's reasoning" is the reasoning content already shown on the page, moved and shown in run order.
- A tab keeps its content by being hidden, not removed, when another tab is shown.
- Feature 004's behaviour when the language model is absent or fails is unchanged.
- Changing what any result shows, the Data tab's contents, and the graph or its controls are out of scope.
