# Feature Specification: "The final test" Tab Redesign

**Feature Branch**: `015-final-test-tab` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-19
**Status**: Draft
**Input**: Redesign The final test tab of the linear regression app so a visitor can see at a glance who won the prediction race, how close each method got, and what the result means for a cricket fan, following the approved design in `specs/015-final-test-tab/design/`.

## Context

This changes The final test tab (features 006, 011 and 012). Today the result is spread across a coloured comparison box and a table of figures, neither of which says plainly who won. The predicted-versus-actual scatter plot does not show which method is more accurate on average. "In cricket terms" reads as a list of facts with no takeaway.

The approved design lives in `specs/015-final-test-tab/design/`. `README.md` is the specification for layout, copy, verdict wording and data; `final-test-tab.html` is a visual reference only (a picture of the design, not something the page ships; every figure, ranking, takeaway and the rule of thumb in it is a placeholder). **Where the two differ, the README wins.** This spec does not repeat the README's copy in full; it states what the feature must deliver and how it is checked.

The tab becomes a header followed by three numbered sections with one heading style, none collapsible:

1. Who won the prediction race: the four methods ranked by average miss as bars from zero ("shorter bar = more accurate"), with one verdict line against the goal.
2. How close did each one get: one bar per method split into within 10 runs, 10 to 20 runs off and more than 20 runs off, with each method's bias in words and the "no method can be perfect" note.
3. In cricket terms: what this tells us: three takeaways, each a short headline plus one or two sentences (the second with a small chart of what moves the prediction), and a rule of thumb a fan can use while watching.

**Removed from this tab**: the comparison box, the accuracy table, the predicted-versus-actual scatter plot and its method toggles, the "How it was chosen" block (it lives on What the agent found, feature 014), and the "miss as a share of a typical total" and R² figures.

**Replaced**: feature 012's "In cricket terms" blocks become the three takeaways and the rule of thumb. Feature 012's rules still apply: the language model writes titles and sentences from named facts with placeholders, code supplies every number, and the template wording is the fallback.

**Unchanged**: the other tabs, the graph and the live summary line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Say who won and whether the goal was reached (Priority: P1)

After the final test step, a visitor opens the tab and, within a few seconds, can say which method had the shortest average miss, how the four compare, and whether the goal was reached.

**Why this priority**: This is the headline the tab exists to give; today it is not stated plainly.

**Independent test**: Show the tab to a person for a few seconds, then ask who won and whether the goal was reached (judged by a person).

**Acceptance Scenarios**:

1. **Given** a finished final test, **When** the tab is opened, **Then** it shows the header (heading "The final test" and a lead naming the test year and number of test innings) and sections 1 to 3 in order, each with a numbered heading in the same style, and no section can be collapsed.
2. **Given** section 1, **Then** four rows are shown sorted by average miss, best first, each with a place label (1st to 4th), the method's name and one-line description, and a horizontal bar from zero on one shared scale with its average miss printed at the end, plus an axis labelled in runs.
3. **Given** the chosen model, **Then** its row says "our pick, chosen before the test" and the other model has no extra note.
4. **Given** the verdict line, **Then** it shows a tick, dash or cross with words: goal reached (the chosen model beat the TV projection by at least the goal margin, naming the runs and the margin), goal missed but the TV was beaten (naming the runs and the margin), or goal missed because the TV was more accurate (naming the runs).
5. **Given** another method (usually the rival's model) has a shorter bar than the chosen model, **Then** one sentence under the verdict names it and says the choice was made before the test, as it must be; with no shorter bar, or a tie, there is no such sentence.
6. **Given** the bars, **Then** methods are told apart by labels, the TV bar is also hatched and the know-nothing bar is grey, so colour is never the only cue.

---

### User Story 2 - See how close each method got (Priority: P1)

The visitor sees, for each method, what share of innings were called within 10 runs, 10 to 20 runs off and more than 20 runs off, and whether the method tends to guess high or low.

**Why this priority**: Average miss alone hides how often a method is close; this shows it and gives honest expectations.

**Independent test**: Compare every percentage, bias phrase and the closing line against the final test's accuracy figures for several runs.

**Acceptance Scenarios**:

1. **Given** section 2, **Then** a key names the three bands (darkest = within 10 runs) and there is one full-width bar per method in the same order as section 1, split into three segments that each print their percentage.
2. **Given** any set of figures, **Then** the three printed shares add to exactly 100: the middle share is the within-20 share minus the within-10 share and the last is 100 minus the within-20 share, both worked out from the displayed figures.
3. **Given** each bar, **Then** the method's name and bias are shown in words ("guesses about right on average", or "guesses N runs too low/high on average") following the existing bias rule, with a large bias emphasised in the TV colour.
4. **Given** the closing line, **Then** it states the within-10 share of the method with the shortest bar (not necessarily the chosen model) in words that follow the figure (for example "about a third", "less than half") and the "no method can be perfect from the halfway mark" note.

---

### User Story 3 - Take away what it means in cricket terms (Priority: P1)

The visitor reads three takeaways and a rule of thumb they can use while watching a match.

**Why this priority**: The practical meaning for a cricket fan is the point of the app.

**Independent test**: Ask a person to state one practical takeaway after reading the section (judged by a person); automatically check every sentence against varied figures.

**Acceptance Scenarios**:

1. **Given** section 3, **Then** the heading is on the left and on the right a label reads "Written by <model name> · every number from code" or, when the template is used, "Template wording · every number from code".
2. **Given** the cards, **Then** there are three side by side (stacked on a phone), each with "Takeaway N", a short headline and one or two sentences: takeaway 1 compares the TV projection with the know-nothing guess; takeaway 2 gives the cost of a wicket lost by the halfway mark and a small chart of the chosen model's features; takeaway 3 gives the TV's bias.
3. **Given** the small chart, **Then** each feature of the chosen model is a bar showing how far a typical difference moves the predicted total, to the right for features that add runs and to the left for those that cost runs, biggest first, each labelled with its sign and value.
4. **Given** the rule of thumb banner, **Then** it is built from the TV's bias and the wicket effect and a fan can apply it while watching.
5. **Given** the TV guesses too high, **Then** takeaway 3 and the rule of thumb say "take off" instead of "add".
6. **Given** the TV clearly beats the know-nothing guess, **Then** takeaway 1 says so; otherwise it says the run rate alone barely helps.
7. **Given** the chosen model has no wicket feature, **Then** takeaway 2 leads with its biggest factor instead of the wicket cost.
8. **Given** the TV's bias is small, **Then** the rule of thumb is about wickets alone.
9. **Given** the language model wrote the wording, **Then** every number in it was filled in by code from named placeholders; if its wording is unusable the template wording is shown.

---

### User Story 4 - Language model does not take part (Priority: P2)

**Why this priority**: A known fallback the tab must handle without breaking.

**Independent test**: Run with no language model and inspect the tab.

**Acceptance Scenarios**:

1. **Given** the language model did not take part, **Then** section 1 has three rows (no AI model), and the verdict names the rival's model as the chosen model.
2. **Given** the same run, **Then** section 2 has three bars and section 3 is based on the rival's model.

---

### User Story 5 - Tab before the final test (Priority: P3)

**Why this priority**: Preserves existing behaviour.

**Independent test**: Open the tab before the final test step is shown.

**Acceptance Scenarios**:

1. **Given** the replay has not reached the final test step, **Then** the tab shows its existing "not ready" sentence (feature 011) and none of the new sections.

---

### User Story 6 - The tab fills in as the replay advances (Priority: P3)

**Why this priority**: Preserves how the other tabs behave during a replay.

**Independent test**: Step the replay through the final test and the step after it.

**Acceptance Scenarios**:

1. **Given** the replay reaches the final test step, **Then** sections 1 and 2 show their bars and bias words, and the verdict line, the section 2 closing line and section 3 are not yet shown.
2. **Given** the next step (the explanation), **Then** the verdict line, the closing line and section 3 appear.

---

### Edge Cases

- The rival's model (or the TV, or the know-nothing guess) has the shortest bar: the "won the race" winner and the chosen model can differ; the verdict still compares the chosen model with the TV and the extra sentence appears only when another method has a strictly shorter bar than the chosen one.
- Ties or equal displayed averages: ordering is stable and the verdict states runs correctly, including zero.
- Within-10 and within-20 shares that are equal (middle share 0) or both 100: segments of zero width stay readable and the shares still total 100.
- A bias that rounds to zero is worded "guesses about right on average", not "0 runs too low".
- All bars equal or very small values: the shared scale still fits every bar and the axis labels do not overlap.
- Chosen model with no features that cost runs, or only one feature: the small chart still draws correctly with its zero line.
- Language model wording unusable or missing a placeholder: the template wording is shown.
- Long method names, feature names or sentences wrap inside their boxes; nothing causes sideways page scroll at 360 px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tab MUST show the heading and lead described in the design README, followed by three numbered sections with one shared heading style, none collapsible and no eyebrow.
- **FR-002**: The comparison box, accuracy table, predicted-versus-actual scatter plot and its toggles, the "How it was chosen" block, and the "miss as a share of a typical total" and R² figures MUST NOT appear on this tab.
- **FR-003**: Section 1 MUST rank the methods by average miss, best first, as bars from zero on one shared scale with values printed and an axis in runs, with the labels, descriptions and non-colour cues in the README.
- **FR-004**: Section 1 MUST show one verdict line against the goal, with a shape and words, in the three forms the README describes.
- **FR-005**: The chosen model MUST be the one picked on the check seasons before the test (feature 008). When another method has a shorter bar than the chosen model, the verdict MUST say so and explain that the choice was made before the test.
- **FR-006**: Section 2 MUST show one bar per method in section 1's order, split into within 10, 10 to 20 and more than 20 runs off, with percentages printed; the three shares MUST always add to 100, worked out from the displayed within-10 and within-20 figures.
- **FR-007**: Section 2 MUST show each method's bias in words following the existing bias rule, and the closing line with the within-10 share of the method with the shortest bar in words and the "no method can be perfect" note.
- **FR-008**: Section 3 MUST show three takeaways (each a headline plus one or two sentences), the small feature-effect chart in takeaway 2, and a rule of thumb banner, replacing feature 012's blocks.
- **FR-009**: Every headline, sentence and the rule of thumb MUST stay true to the figures: direction of the TV's bias (add vs take off), whether the TV clearly beats the know-nothing guess, presence or absence of a wicket feature, and whether the TV's bias is small.
- **FR-010**: Wording MUST follow feature 012: the language model writes titles and sentences from named facts with placeholders, code fills every number, and the template wording is the fallback; the source label MUST name the model or say "Template wording".
- **FR-011**: Every number MUST come from the run's state, never typed into the page: the test year and innings count, each method's accuracy figures, the chosen model and goal verdict, the chosen model's feature effects and wicket cost, and the wording source and model name.
- **FR-012**: When the language model did not take part, section 1 MUST have three rows and the verdict MUST name the rival's model.
- **FR-013**: Before the final test step is shown, the tab MUST show its existing "not ready" sentence.
- **FR-014**: Methods MUST be told apart without relying on colour (labels, hatching for the TV, grey for the know-nothing guess, words or shapes with every colour).
- **FR-015**: The tab MUST work in light and dark mode and at 360 px wide with no sideways page scroll; nothing animates.
- **FR-016**: The other tabs, the graph and the live summary line MUST be unchanged, and all existing tests MUST pass, updated only where they checked the removed comparison box, table, scatter plot or old cricket-terms blocks.

### Key Entities

- **Final test result**: the test year, number of test innings and, for each method (AI's model, rival's model, TV projection, know-nothing guess), its average miss, within-10 and within-20 shares and bias.
- **Chosen model and goal verdict**: which of the two models was picked before the test, the goal margin and whether the goal was reached.
- **Chosen model facts**: each feature's effect for a typical difference and the cost of a wicket lost by the halfway mark (absent if there is no wicket feature).
- **Cricket-terms wording**: the three takeaways and the rule of thumb, with the wording source (language model and its name, or template).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within a few seconds of viewing the tab, a visitor can say who won the prediction race, whether the goal was reached, and one practical takeaway (judged by a person).
- **SC-002**: Every number on the tab matches the run's state, checked automatically across a run with the language model, a run without it, and a run where the rival's model wins the race.
- **SC-003**: Each data-dependent sentence (verdict, rival-wins sentence, bias phrases, closing line, each takeaway and the rule of thumb) is checked automatically against at least three differing sets of figures.
- **SC-004**: In every set of figures checked, the three shares in section 2 total exactly 100 for every method.
- **SC-005**: No method is identified by colour alone, verified by automated and visual check.
- **SC-006**: The tab is readable in light and dark mode and at 360 px wide with no sideways page scroll, and nothing animates.
- **SC-007**: The other tabs, the graph and the live summary line are unchanged, and the full existing test suite passes, with tests changed only where they checked the removed comparison box, table, scatter plot or old cricket-terms blocks.

## Assumptions

- The design README's copy and rules are the source of truth; where it contains placeholders, the run supplies the values.
- The method colour tokens, win/lose tokens and the TV colour token from feature 013 already exist and are reused.
- The "existing bias rule", "typical difference" feature effects and wicket cost are those already produced for feature 012; this feature changes how they are presented and worded, not how they are computed.
- The goal margin and verdict come from the existing goal (feature 006) and the winner decided before the test (feature 008); this feature only presents them.
- "TV clearly better" is the existing reference finding (`clearly_better`, from the share set by the goal rules); "a large bias" is the existing rule (bias at least half the average miss, either way). A "small TV bias" is one that is not large, so the rule of thumb is about wickets alone. No new thresholds are introduced.

## Clarifications

### Session 2026-10-19

- No questions asked: the one open point (the "clearly better" and "small bias" thresholds) is already defined in the existing goal and accuracy rules, now recorded under Assumptions.
- Fixed headings and descriptions (for example the method names) are page copy; only figures must come from the run.
