# Feature Specification: A Visual "In Cricket Terms", Then Written by the Language Model

**Feature Branch**: `012-visual-cricket-terms` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-10
**Status**: Draft
**Input**: Redesign the "In cricket terms" section so it explains the result through titles, charts and a few short sentences instead of a long list, and let the language model write those titles and sentences, with code supplying every number.

## Context

This changes the "In cricket terms" section on The final test tab of the linear regression agent app (features 001 to 011). Today the section is a list of 10 to 12 template sentences: the check years, how the winner was chosen, the test-year misses, the features used, the biggest factor, the cost of a wicket and the verdict. Several repeat figures already shown in the accuracy table and chart on the same tab. It is a lot of reading for cricket fans, and the most interesting findings are buried.

This feature has two parts, written as separate user stories so they can be built and shipped in order:

1. A visual layout using template wording (**User Story 1**). It works fully on its own.
2. Language-model wording on top of that layout (**User Story 2**).

Feature 004 listed "the language model writing the final explanation" as out of scope. This feature deliberately changes that, under strict rules: **the language model writes words only, and every number still comes from code.**

### The facts

At the end of a run, code works out a fixed set of named facts from the run's state. Examples: whether the goal was reached; by how many runs the winner beat the TV projection; by how many runs it beat the know-nothing guess; the share of innings within 10 runs; each feature's effect in runs for a typical difference; the biggest factor; the cost of a wicket lost by the halfway mark; the check years and the test year; which method won and on what validation error. The facts are the only source of every number in the section, in both stories.

## Clarifications

### Session 2026-10-10

- Q: Where does the language-model wording get written? → A: Inside the run, as a final step of the agent, so the finished wording (the model's, or the template fallback chosen in that same step) is part of the run's state and of the replay. The run has two steps for the section: a code step that builds the facts and the template wording, and the writing step after it. The replay shows the template wording from the code step and the final wording from the writing step, like any other result; a run with no model shows the template wording throughout.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visual "In cricket terms" (Priority: P1)

A cricket fan opens The final test tab and finds, under the accuracy results, a short sequence of blocks. Each block has a title, one visual and one or two sentences:

1. **The verdict**: a headline stating whether the winner beat the TV projection and by how many runs, with a clear "goal reached" or "goal missed" badge against the 3-run goal. The badge uses words and a shape, not colour alone.
2. **What drives the final total**: a bar chart of each feature in the winning model, showing how many runs a typical difference in that feature moves the predicted total. Features that add runs extend one way and those that cost runs the other, sorted with the biggest effect first, each bar labelled with its value and the feature's plain name.
3. **What a wicket costs**: a single large figure for the runs a wicket lost by the halfway mark costs by the end of the innings, with one sentence of context. If the run found a wicket did not cost runs, the block says so plainly and advises caution, as today. If the winning model has no wicket feature, the block is left out.
4. **How it was chosen**: a small strip of years showing the training years, the three check years and the test year, with one sentence saying the winner was chosen on the check years before the test year was touched.
5. **A closing sentence** on what the result means for a cricket fan.

Sentences that only repeat figures already in the accuracy table or chart are removed. Nothing that matters is lost: every figure removed from the text is still shown elsewhere on the tab. In this story all wording comes from templates filled in from the facts. Charts are readable in light and dark mode and at phone width, do not rely on colour alone, and each has a text equivalent giving its values. Nothing animates.

**Why this priority**: It is the whole redesign and works without the language model.

**Independent test**: Run the agent with the language model absent; the section shows the five blocks, with every number equal to a fact, in at most half the words of today's list.

**Acceptance Scenarios**:

1. **Given** a finished run, **Then** the section shows the verdict, drivers, wicket cost (when applicable), how it was chosen and the closing sentence, in that order.
2. **Given** the winner beat the TV projection by at least 3 runs, **Then** the verdict states the margin and the badge reads "goal reached".
3. **Given** the winner did not beat the TV projection, **Then** the verdict says so plainly and the badge reads "goal missed".
4. **Given** the winner beat the projection by less than 3 runs, **Then** the verdict says it beat the projection but missed the goal, and the badge reads "goal missed".
5. **Given** the winning model has several features, **Then** the bar chart lists each with its plain name and value, biggest effect first, adding runs one way and costing runs the other.
6. **Given** the winning model has only one feature, **Then** the chart shows one bar and still reads correctly.
7. **Given** very unequal effects, **Then** the smallest bars remain visible and labelled.
8. **Given** the winning model has no wicket feature, **Then** the wicket block is absent; **Given** a wicket was found not to cost runs, **Then** the block says so plainly and advises caution.
9. **Given** each chart, **Then** it has a text equivalent giving its values, works in light and dark themes and at phone width, and does not rely on colour alone.
10. **Given** the visitor steps back through the replay, **Then** the section shows what was on screen at that step.
11. **Given** any number in the section, **Then** it equals a fact computed by code.
12. **Given** the same run, **Then** the section's visible text is at most half the word count of the old list.

---

### User Story 2 - The language model writes the words (Priority: P2)

After the final test, the run's own final step asks the language model chosen for the run to write each block's title and sentences, given the facts by name (with their values and units) and the fixed set of blocks. It writes numbers only as placeholders naming a fact (for example "each wicket costs {wicket_cost} runs"); code fills them in with the facts' values. A reply containing any digit written by the model, a placeholder for a fact that does not exist, or a title or sentence over a set length is rejected.

It may choose the order of blocks 2 to 4 and which fact the closing sentence leads with. It may not add, remove or invent blocks, charts or facts. It may add cricket context in words, but must not state anything as a statistic that is not a fact; the instruction says so, and the section notes that the words are written by a language model. The section shows a small label saying the wording was written by the language model and naming the model, styled like the model's reasoning elsewhere on the page.

If the language model did not take part in the run, is unavailable, times out, exceeds the run's call or time budget, or its reply is rejected, the section uses the template wording from story 1 and says so in one short line. The run never fails or waits beyond its time limit because of this step. This call counts towards the run's existing limits on language-model calls and time (feature 004); the rest of the run keeps its time. The wording, whichever kind, is decided inside that step and is part of the run's state, so the replay shows it like any other result.

**Why this priority**: It improves the writing but depends on story 1's layout and must never be required for it.

**Independent test**: Run with the scripted fake model returning a valid reply, then replies containing digits, unknown placeholders, over-length text, a missing sentence, and failures; check what is shown each time.

**Acceptance Scenarios**:

1. **Given** a valid reply, **Then** the section shows the model's titles and sentences with placeholders replaced by fact values, the label naming the model, and the model's block order for blocks 2 to 4.
2. **Given** a reply with a digit written by the model, an unknown placeholder or an over-length title or sentence, **Then** the reply is rejected and the template wording is shown, with one short line saying so.
3. **Given** a well-formed reply that omits one block's title or sentence, **Then** that block uses its template wording and the rest keeps the model's.
4. **Given** the model did not take part, is unavailable, times out or the run's budget is spent, **Then** the template wording is shown with one short line saying so, and the run finishes within its time limit.
5. **Given** a reply that tries to add, remove or invent a block, chart or fact, **Then** it is rejected (or the extra is ignored) and no block, chart or fact outside the fixed set appears.
6. **Given** the call is made, **Then** it counts towards the run's call and time limits.
7. **Given** automated tests, **Then** none calls a real language model.

### Edge Cases

- The winner did not beat the TV projection: the verdict says so plainly in both stories and the badge reads "goal missed".
- The winner beat the projection by less than the goal: it says so, and the badge reads "goal missed".
- One feature only; very unequal effects (smallest bars still visible and labelled).
- The wicket cost cannot be computed or the model has no wicket feature: the block is left out; a wicket that did not cost runs: said plainly with caution.
- A reply that is well-formed but leaves out a block's title or sentence: that block falls back to its template wording.
- A reply whose placeholder is a real fact but used where its unit makes no sense: still accepted (it is only a value substitution); the length and digit checks are the safety rules.
- The visitor steps back before the final test: the section is absent (as other final-test results are) and returns when the final step is shown.
- The language-model step is slow: the step is bounded by the run's time budget; if the budget is spent the step finishes with the template wording. There is never a replacement after the run: the replay shows the template wording from the code step and the final wording from the writing step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: At the end of a run, code MUST compute a fixed set of named facts from the run's state; they are the only source of every number in the section, in both stories.
- **FR-002**: The section MUST be a sequence of blocks: the verdict, what drives the final total, what a wicket costs (when applicable), how it was chosen, and a closing sentence, each with a title, one visual and one or two sentences (the closing block is one sentence).
- **FR-003**: The verdict MUST state whether the winner beat the TV projection and by how many runs, with a "goal reached" or "goal missed" badge against the goal margin, using words and a shape, not colour alone; a win by less than the margin MUST read as beat the projection but missed the goal.
- **FR-004**: The drivers block MUST show a bar chart of every feature in the winning model with its effect in runs for a typical difference, sorted biggest first, adding runs one way and costing runs the other, each bar labelled with value and plain name; one-feature and very unequal cases MUST read correctly with every bar visible and labelled.
- **FR-005**: The wicket block MUST show one large figure for the runs a wicket lost by the halfway mark costs by the end, with one sentence of context; if a wicket did not cost runs it MUST say so plainly and advise caution; if the winning model has no wicket feature the block MUST be left out.
- **FR-006**: The "how it was chosen" block MUST show a strip of the training years, the three check years and the test year, and one sentence that the winner was chosen on the check years before the test year was touched.
- **FR-007**: Sentences that only repeat figures already in the accuracy table or chart MUST be removed, and every figure removed from the text MUST still be shown elsewhere on the tab.
- **FR-008**: In story 1 all wording MUST come from templates filled in from the facts.
- **FR-009**: Charts MUST be readable in light and dark themes and at phone width, MUST NOT rely on colour alone, MUST have a text equivalent giving their values, and nothing MUST animate.
- **FR-010**: The section's visible text MUST be at most half the word count of the old list of sentences for the same run.
- **FR-011**: Every number shown in the section MUST equal a fact computed by code, in both stories, checked automatically.
- **FR-012**: After the final test, a final step of the run MUST ask the language model chosen for the run to write each block's title and sentences from the facts (by name, with values and units) and the fixed set of blocks; it MUST write numbers only as placeholders naming a fact, which code fills in.
- **FR-013**: A reply MUST be rejected if the model wrote any digit, used a placeholder for a fact that does not exist, or exceeded the set length for a title or sentence; a rejected reply MUST never be shown.
- **FR-014**: The model MAY choose the order of blocks 2 to 4 and which fact the closing sentence leads with, and MUST NOT add, remove or invent blocks, charts or facts or state anything as a statistic that is not a fact.
- **FR-015**: A well-formed reply that leaves out a block's title or sentence MUST leave that block on its template wording while the rest keeps the model's.
- **FR-016**: The section MUST show a small label that the wording was written by the language model, naming the model, styled like the model's reasoning elsewhere on the page.
- **FR-017**: If the language model did not take part, is unavailable, times out, exceeds the run's call or time budget, or its reply is rejected, the section MUST use the template wording and say so in one short line; the run MUST NOT fail or wait beyond its time limit because of this step.
- **FR-018**: The model call (made in that step) MUST count towards the run's existing limits on language-model calls and time (feature 004), and the rest of the run MUST keep its time.
- **FR-019**: The section MUST follow the replay: its wording is part of the run's state and appears from the step that produced it, so stepping back shows what was on screen at that step, as other results do.
- **FR-020**: Automated tests MUST NOT call a real language model.
- **FR-021**: How any fact is calculated, the accuracy table, the predicted-versus-actual chart and the other tabs MUST NOT change.

### Key Entities

- **Fact**: a named value computed by code (with a unit), such as `goal_reached`, `beat_tv_by`, `beat_know_nothing_by`, `share_within_10`, a feature's effect, `biggest_factor`, `wicket_cost`, `check_years`, `test_year`, `winner`, `validation_error`.
- **Block**: one of the fixed blocks (verdict, drivers, wicket cost, how chosen, closing), with a title, a visual and one or two sentences.
- **Wording**: the title and sentences of each block, from templates or (story 2) from the language model with placeholders filled from facts.
- **Reply**: the language model's structured answer: titles and sentences with placeholders, an order for blocks 2 to 4 and the lead fact for the closing sentence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every number in the section equals a fact computed by code, in both stories, checked automatically, including for replies that try to include their own numbers.
- **SC-002**: With language-model wording, no reply containing a model-written digit or an unknown placeholder is ever shown.
- **SC-003**: The section's visible text is at most half the word count of today's list for the same run, checked automatically.
- **SC-004**: A reader with no machine learning background can say, after a few seconds, whether the goal was reached, what mattered most and what a wicket cost (judged by a person, as in earlier reader reviews).
- **SC-005**: When the language model fails or is absent, the section still appears complete with template wording, and the run finishes within feature 004's time limit.
- **SC-006**: Automated tests never call a real language model.
- **SC-007**: All existing tests still pass, updated only where they checked the old list of sentences.

## Assumptions

- The facts are derived from state the run already holds (the accuracy results, the winning model's coefficients and feature spreads, the split years), so no calculation changes; where a fact such as a feature's effect for a typical difference is already computed for the old sentences, it is reused.
- The set length for a title or sentence is chosen at planning (short enough to keep the section well under half the old word count).
- The model's reply is a structured answer the code can check, not free text; the exact shape is decided at planning.
- "Plain name" for a feature is the same wording the page already uses for features.
- The label for model-written wording reuses the style of the model's reasoning elsewhere on the page.
- If the visitor steps back before the final test step, the section is absent, as other final-test results are today.
- Out of scope: changing how any fact is calculated, the accuracy table, the predicted-versus-actual chart, the other tabs, and letting the language model choose or produce any number, chart or block.

## Decisions made while implementing

- **Thresholds are facts**: the "within N runs" threshold is a fact (`within_runs_threshold`), so the model can write "within {within_runs_threshold} runs" with no digit of its own.
- **Wicket block variants**: cost, did not cost runs, wickets in hand worth, and omitted (no wicket feature).
- **Visible text** for the half-the-words limit means what a sighted visitor reads (titles, sentences, badge, bar names and values, the large figure and the strip's labels); the visually hidden text equivalents are not counted.
- **Closing lead facts** the model may choose from: `goal_reached`, `biggest_factor`, `wicket_cost`, `beat_know_nothing_by` (those that exist for the run).
- **Budget**: the writing call is allowed one call beyond the proposing cap (it counts in the run's calls), so proposing retries cannot starve it and the proposing cap is unchanged; its time is what the deadline allows less one second.
- **Limits**: a title is at most 50 characters and a sentence at most 130; at most two sentences per block, one for the closing block.
