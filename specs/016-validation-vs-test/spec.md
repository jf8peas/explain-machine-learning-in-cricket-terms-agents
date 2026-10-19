# Feature Specification: Validation versus Test: Making the Two Tabs Agree

**Feature Branch**: `016-validation-vs-test` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-19
**Status**: Draft
**Input**: Make What the agent found (feature 014) and The final test (feature 015) say which exam each score comes from, explain why the two sets of scores differ, and stop implying that small gaps decide anything, following the approved design in `specs/016-validation-vs-test/design/`.

## Context

What the agent found says the rival won with 17.0 on the check seasons. The final test then ranks the AI's model 1st with 17.7 on the test season. Both are correct, but the page never says they come from two different exams, so visitors read the tabs as contradicting each other.

- **Validation** (cross-validation on the check seasons): used again and again to compare candidate models and **choose** one.
- **Test** (the final season): used once, after the choice, to **judge** it. It played no part in learning, tuning or choosing, so it is the honest number.

The approved design lives in `specs/016-validation-vs-test/design/`. `README.md` is the specification for copy, layout and data; `found-tab-validation.html` and `final-test-tab-test.html` are visual references only (pictures, not something the page ships; their figures follow one real run and anything marked as a placeholder is one). **Where the two differ, the README wins.** This spec states what the feature must deliver and how it is checked; everything the design does not mention stays as features 014 and 015 built it.

The principles:

1. Every score says which exam it comes from, in words and with a consistent visual label.
2. The check seasons **choose**; the test **judges**. The page never calls either one "the winner".
3. The final test leads with **our pick** (the candidate model chosen on validation), not with a ranking.
4. The page explains why the two exams give different numbers, and says the test is the one to trust.
5. Gaps too small to matter are called **too close to call**.

**Changed**: What the agent found (labels, banner, choice panel, headings and score labels); The final test (new section 1 "How did our pick do?", new section 2 "Why the scores differ from What the agent found", the old sections 2 and 3 renumbered to 3 and 4); the "too close to call" rule on both tabs; takeaway 1's wording; the instructions given to the language model for its reasons; the width of both tabs' leads.

**Unchanged**: the other tabs, the graph, the live summary line, how every figure is calculated, and the rule that the test year is used only in the final test.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tell which exam every score comes from (Priority: P1)

A visitor reading either tab can tell, from labels alone, whether each score is from validation (the check seasons) or the test.

**Why this priority**: This removes the apparent contradiction, which is the purpose of the feature.

**Independent test**: Show each tab to a person with every label visible and ask, for ten scores picked at random, which exam it comes from (judged by a person); check automatically that every score has an exam label nearby.

**Acceptance Scenarios**:

1. **Given** What the agent found, **When** the tab is opened, **Then** under its lead a full-width banner shows an amber VALIDATION pill and says every score on the tab comes from the check seasons (first to last check year, from the run), used to choose a candidate model and not to judge it, and that the honest verdict comes from the final test.
2. **Given** The final test, **When** the tab is opened, **Then** under its lead a full-width dark banner shows a TEST pill and says every score on the tab comes from the test year, a season never used for learning, tuning or choosing, and that these are the honest numbers.
3. **Given** any score on What the agent found, **Then** its label says "on the check seasons" (or sits in a panel marked VALIDATION); in the race chart, the choice panel, the grid's best-cell line and the ranking's column heading.
4. **Given** any score on The final test, **Then** it sits under the TEST label or says it is from the test year.
5. **Given** both themes, **Then** the pills, banners and panels keep at least 4.5:1 text contrast.
6. **Given** the whole of both tabs, **Then** the word "winner" appears for neither exam; the chosen candidate model is "our pick" or "chosen on validation".

---

### User Story 2 - Understand what the check seasons are for (Priority: P1)

On What the agent found, the visitor sees that the check seasons choose a candidate model and the test season judges it, and sees which candidate model was chosen without being told it won.

**Why this priority**: The first tab is where the contradiction starts.

**Independent test**: Compare every heading, caption and the choice panel with the design README and the run's state.

**Acceptance Scenarios**:

1. **Given** section 2, **Then** its heading ends "(cross-validation)", its lead adds that these scores are used again and again to compare candidate models, which is why they cannot also be the final verdict, the check-season segments carry the validation outline and fill, and a caption row under the strip labels them "VALIDATION: USED TO CHOOSE" and the test segment "TEST".
2. **Given** section 3, **Then** its heading is "The race on the check seasons", the chart's vertical axis label reads "average miss on check seasons" and its caption ends "All scores are on the check seasons."
3. **Given** the choice panel, **Then** it has the label "Chosen on validation", the heading "The <chosen>'s candidate model", the chosen and the other method's check-season misses, whether the gap is too close to call or how many runs better, a sentence that a choice still has to be made so the lower score goes forward and that the final test settles how good it really is, and the link to The final test; its left border takes the chosen method's colour.
4. **Given** the two best candidate models are within the too-close threshold on the check seasons, **Then** the panel heading adds ", by a whisker" and the text says the gap "is too close to call: the two are about equally good", and the sentence about having to choose appears.
5. **Given** the gap is the threshold or more, **Then** the panel says how many runs better the chosen candidate model is, and "too close to call" appears nowhere on the tab.
6. **Given** a tie on the check seasons, **Then** the AI's candidate model goes forward as today and the wording says the two are too close to call.
7. **Given** the choice has not been recorded yet (the search is still going), **Then** the panel says so, as feature 014 built it, without the word "winner" and without any score comparison.
8. **Given** sections 5 and 6, **Then** the grid's best-cell line and the ranking's score column heading say "on the check seasons" ("Average miss on check seasons (runs)").

---

### User Story 3 - See how our pick did on the test (Priority: P1)

On The final test, section 1 opens with the chosen model's test score beside the goal verdict, then the four bars, without a ranking.

**Why this priority**: The tab's first answer should be the one the visitor is here for: how the pick did when judged.

**Independent test**: Compare the card, bars and sentence with the run's accuracy figures for at least three differing sets of figures.

**Acceptance Scenarios**:

1. **Given** section 1, **Then** its heading is "How did our pick do?" and it opens with a large card in the chosen method's colour: "Our pick: the <chosen>'s model", its test average miss as the big figure with "runs off, on average", and "Chosen on the check seasons, before <test year> was touched."
2. **Given** the card, **Then** beside it is the goal verdict card with the three variants from feature 015 and unchanged wording.
3. **Given** the bars, **Then** the four methods (three without the AI's model) are shown as in feature 015 in test-average-miss order with "Shorter bar = more accurate", no 1st to 4th place labels, and an outlined "our pick" tag on the chosen model's row.
4. **Given** the sentence under the bars, **Then** it compares the AI and the rival on the test: "too close to call" when their gap is under the threshold, otherwise which was more accurate and by how much; and it says whether both beat the TV projection and the know-nothing guess.
5. **Given** another method has the shortest bar, **Then** feature 015's extra sentence is not shown (this sentence and section 2 replace it).

---

### User Story 4 - Understand why the two tabs' scores differ (Priority: P1)

A new section 2 on The final test explains why the same two models score differently on the check seasons and on the test, using this run's figures, and tells the visitor to trust the test.

**Why this priority**: Without this, the visitor still sees two sets of numbers and no explanation.

**Independent test**: Compare every figure in the section with `validation_winner`, the two best candidate models and the final test's accuracy figures, for at least three differing sets of figures.

**Acceptance Scenarios**:

1. **Given** section 2, **Then** it is titled "Why the scores differ from What the agent found", with the lead "The same two models, sat in two different exams." and one sentence saying who was ahead on each exam (for example the rival on the check seasons and the AI on the test), with "Both gaps are tiny." only when both gaps are under the threshold.
2. **Given** the two cards, **Then** a VALIDATION card ("Check seasons <years>", used to choose, seen many times while comparing candidate models) and a TEST card ("Final test <year>", used once to judge, never seen before) sit side by side, each with a bar and value for the rival and the AI, on one shared scale from zero.
3. **Given** the three reasons, **Then** they read: different seasons (the test year is a new season with its own conditions and any model's miss moves a little); choosing flatters the pick ("<n> candidate models were tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh data."); the test is the clean one (nothing was fitted to it, so when the two disagree trust the test).
4. **Given** the number of candidate models tried, **Then** the second reason's <n> is the run's count (the AI's fitted attempts plus the grid's allowed combinations), never a word such as "dozens" typed into the page, and the section's title for this reason is "Choosing flatters the pick".
5. **Given** the old sections 2 and 3 of The final test, **Then** they are now sections 3 and 4; section 3 says "Every <test year> innings", its closing line says "Even our pick…", and the chosen model's row carries the "our pick" tag.
6. **Given** the whole tab, **Then** it is four numbered sections with one heading style and none collapsible.

---

### User Story 5 - Small gaps are called too close to call (Priority: P1)

Wherever two models' average misses on the same exam are compared, a gap under 0.5 runs is called too close to call rather than implying one is better.

**Why this priority**: Without it the pages keep implying a ranking the figures do not support.

**Independent test**: Run the same comparison at gaps of 0.49, 0.5 and larger, on both exams, and read both tabs.

**Acceptance Scenarios**:

1. **Given** the screenshot run (validation: rival 17.0, AI 17.4; test: AI 17.7, rival 17.8), **Then** both tabs say "too close to call".
2. **Given** a gap of 0.5 runs or more on an exam, **Then** neither tab says "too close to call" for that comparison.
3. **Given** a gap just under 0.5 (for example 0.49), **Then** it is called too close to call; at exactly 0.5 it is not.
4. **Given** the threshold, **Then** it is one named value, TOO_CLOSE_RUNS = 0.5, defined once in one shared browser module that both tabs import; each comparison uses the one-decimal scores the page displays (0.49 is too close, exactly 0.5 is not); the server never decides "too close to call" and holds no copy of the threshold.
5. **Given** too close to call on validation, **Then** a choice is still made (the lower score goes forward, ties to the AI as today) and the wording says so.

---

### User Story 6 - Takeaway 1 handles rising totals (Priority: P2)

When the know-nothing guess is far off because totals have risen, takeaway 1 says so in plain words instead of only comparing the TV with it.

**Why this priority**: The current wording is misleading when the know-nothing guess is poor for a reason unrelated to the run rate.

**Independent test**: Check takeaway 1's wording for runs where the know-nothing guess leans low by a large amount, leans high, and leans neither way.

**Acceptance Scenarios**:

1. **Given** the know-nothing guess is far off and its bias shows totals have risen (it guesses too low), **Then** takeaway 1 says so (for example "Scores keep climbing") and stays true to the figures.
2. **Given** it is far off but not because totals rose, **Then** the wording does not say totals have risen.
3. **Given** the know-nothing guess is not far off, **Then** takeaway 1 keeps feature 015's wording.
4. **Given** the language model wrote the wording, **Then** direction words still reach the page only through placeholders.

---

### User Story 7 - The language model gives reasons in plain cricket words (Priority: P2)

The reasons the AI gives for each proposal read in plain cricket words, with no figures and no column names.

**Why this priority**: Reasons appear on What the agent found; figures or column names in them break the "every number comes from code" rule and confuse readers.

**Independent test**: Check the instructions sent to the language model for the rule, and show a scripted reply that breaks it to confirm what the page does with it.

**Acceptance Scenarios**:

1. **Given** the instructions for proposing a candidate model, **Then** they ask for the reason in plain cricket words, with no figures and no column names.
2. **Given** the scripted (fake) model, **Then** no test calls a real language model, and the key never reaches the browser.

---

### User Story 8 - Both tabs' leads run the full width (Priority: P3)

The lead paragraph of What the agent found and of The final test uses the full width of the container.

**Why this priority**: A small layout fix the visitor asked for.

**Independent test**: Measure the lead's width against its container at desktop width.

**Acceptance Scenarios**:

1. **Given** either tab at desktop width, **Then** its lead is as wide as the tab's container.

---

### User Story 9 - Language model does not take part (Priority: P2)

**Why this priority**: A known fallback both tabs must handle without breaking.

**Independent test**: Run with no language model and read both tabs.

**Acceptance Scenarios**:

1. **Given** the language model did not take part, **Then** section 2 of The final test shows the rival's validation and test scores alone, keeps the three reasons and drops the comparison sentence.
2. **Given** the same run, **Then** neither tab uses "too close to call", and the choice panel names the rival's candidate model.

---

### Edge Cases

- Equal check-season scores: the AI goes forward as today and the wording says too close to call.
- A gap exactly at the threshold is not too close to call; just under it is. Comparisons use the displayed one-decimal scores so the page never contradicts the figures it shows.
- The two exams disagree on who is ahead, or agree: the lead sentence in section 2 says so truthfully in each case, and "Both gaps are tiny." appears only when both are under the threshold.
- Only one exam's gap is under the threshold: the lead sentence names who was ahead on each and does not say both are tiny.
- The AI's rounds were all rejected or it failed: no AI score exists on either exam; the page follows the no-language-model behaviour.
- Very large or very small numbers of candidate models scored: the reason always shows the run's own count; a word such as "dozens" is never typed into the page.
- The chosen model has the shortest test bar or not: both read correctly with no ranking labels.
- Long method names and captions wrap; the banners wrap under their pills; nothing causes sideways scroll at 360 px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both tabs MUST show a full-width banner under their lead with an exam pill (amber VALIDATION on What the agent found, dark TEST on The final test) and the explanation of that tab's exam, with the check years and the test year taken from the run.
- **FR-002**: Every score on both tabs MUST carry an exam label in words ("on the check seasons", or a TEST or VALIDATION panel) so a visitor can tell its exam from labels alone. Where a section already states its exam once for all its scores, that statement counts (the rounds section's note "Scores are average misses across the three check seasons", together with the tab's banner, covers the round cards).
- **FR-003**: The word "winner" MUST NOT appear on either tab for either exam; the chosen candidate model is called "our pick" or "chosen on validation".
- **FR-004**: What the agent found MUST change section 2's heading and lead, season strip labels and caption row, section 3's heading, chart axis label and caption, sections 5 and 6's score labels, and replace the winner panel with the "Chosen on validation" panel, as in the design README.
- **FR-005**: The choice panel MUST point to The final test for the verdict, take the chosen method's colour as its left border, and state a choice still has to be made when the gap is too close to call.
- **FR-006**: The final test's section 1 MUST be "How did our pick do?": the our-pick card, the goal verdict card beside it (feature 015's three variants, unchanged wording), the four bars without place labels and with the "our pick" tag, and the comparison sentence about the AI and the rival.
- **FR-007**: The final test MUST have a new section 2, "Why the scores differ from What the agent found", with the lead, the VALIDATION and TEST cards on one shared scale from zero, and the three reasons; the previous sections 2 and 3 MUST become 3 and 4 with the wording changes the design lists.
- **FR-008**: When two models' average misses on the same exam differ by less than the too-close threshold (TOO_CLOSE_RUNS = 0.5, defined once in one shared browser module that both tabs import and compared on the displayed one-decimal scores; the server never decides it and holds no copy), the pages MUST say "too close to call" and MUST NOT imply one is better; at or above it they MUST NOT say it.
- **FR-009**: A choice MUST still be made on validation (the lower score goes forward, ties to the AI as today) and the wording MUST say so when too close to call.
- **FR-010**: Takeaway 1 MUST handle the know-nothing guess being far off because totals have risen, using its bias, and MUST stay true to the figures.
- **FR-011**: The instructions for proposing a candidate model MUST ask for reasons in plain cricket words, with no figures and no column names.
- **FR-012**: Both tabs' leads MUST run the full width of their container.
- **FR-013**: Every number MUST come from the run's state: validation figures from the validation decision and both best candidate models, test figures from the final test's accuracy figures, the check-season TV score from the run's baseline, the number of candidate models from the AI's fitted attempts plus the grid's allowed cells. No new calculation, and nothing typed into the page or written by the language model, which writes words only, using placeholders.
- **FR-014**: The test year MUST still be used only in the final test; the pages MUST NOT show test figures before the final test step.
- **FR-015**: When the language model does not take part, section 2 of The final test MUST show the rival's two scores alone, keep the three reasons, drop the comparison sentence, and neither tab MUST use "too close to call".
- **FR-016**: Both themes MUST keep 4.5:1 text contrast on every new pill, banner, card and panel, using a validation token beside the existing method tokens; at 360 px the banners wrap, the cards and reasons stack, and there is no sideways page scroll; nothing animates.
- **FR-017**: The other tabs, the graph and the live summary line MUST be unchanged, tests MUST never call a real language model, the OpenRouter key MUST never reach the browser, and all existing tests MUST pass, updated only where they checked wording or structure this feature changes.

### Key Entities

- **Exam**: validation (the check seasons, used to choose) or test (the test year, used once to judge); every score belongs to exactly one.
- **Chosen candidate model ("our pick")**: the candidate model that goes forward, decided on validation before the test; the lower check-season score, ties to the AI.
- **Exam scores**: each model's average miss on validation and on the test, plus the TV and know-nothing references on the test and the TV on the check seasons.
- **Too-close threshold**: TOO_CLOSE_RUNS, the single named gap (0.5 runs) under which two displayed scores on the same exam are called too close to call; defined once in one shared browser module and not held by the server.
- **Candidate models scored**: the AI's fitted attempts plus the grid's allowed combinations, used for the "how many were tried" count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can tell from labels alone which exam every score on both tabs comes from (judged by a person; checked automatically that every score has an exam label).
- **SC-002**: The word "winner" appears nowhere on either tab, checked automatically across a run with the language model, a run without it, and a run where the pick and the best test score differ.
- **SC-003**: The final test explains the difference from What the agent found, using figures from the same run: every figure in its section 2 matches the run's state, checked automatically for at least three differing sets of figures.
- **SC-004**: With the run in the design (validation: rival 17.0, AI 17.4; test: AI 17.7, rival 17.8), both tabs say "too close to call".
- **SC-005**: When a gap is 0.5 runs or more, neither tab says "too close to call"; checked at 0.49, 0.5 and larger gaps on both exams.
- **SC-006**: Every headline and sentence this feature adds or changes is checked automatically against at least three differing sets of figures and stays true to them.
- **SC-007**: Both themes keep 4.5:1 text contrast on every new pill, banner, card and panel; at 360 px there is no sideways scroll and the banners, cards and reasons wrap or stack; nothing animates.
- **SC-008**: The other tabs, the graph and the live summary line are unchanged, and the full existing test suite passes, with tests changed only where they checked wording or structure this feature changes.

## Assumptions

- The design README's copy and rules are the source of truth; where it contains placeholders, the run supplies the values.
- The method colour tokens and the win/lose tokens already exist; a validation token is added beside them.
- The AI's and the rival's best candidate models, the validation decision and the check-season TV score already exist in the run state; no new calculation is introduced. The final tab may read the two validation scores from the copy the final test already stores beside the test scores (`final.validation_mae`, the same numbers as the best candidate models'), so both exams appear in the same replay step.
- Comparisons for "too close to call" are made in the browser, in one shared module both tabs import, on the one-decimal scores the page displays, so the page never says "too close to call" for a gap that its own figures show as 0.5 or more. The server holds no copy of the threshold and never decides it.
- The leads' full width was already applied to both tabs in a recent change; it remains a requirement here so it is checked.
- "Far off because totals have risen" (takeaway 1) uses the existing large-bias rule on the know-nothing guess (its bias at least half its average miss, and leaning too low, meaning actual totals ran above the training years' average). This variant is decided on the server and does not use the too-close threshold; no new threshold is introduced.
- "The honest verdict comes from the final test" is page copy; only figures must come from the run.

## Clarifications

### Session 2026-10-19

- No questions asked: the one open point (what counts as the know-nothing guess being "far off" in takeaway 1) has a default in the existing large-bias rule, recorded under Assumptions.
- Terminology: commit 74b0661 renamed "setup" to "candidate model" across the app, so this spec and the design README use "candidate model" everywhere ("Chosen candidate model ("our pick")", the choice panel heading "The <chosen>'s candidate model", "Candidate models scored"). The two HTML files are pictures only and are left as they are.
- No "winner" anywhere: the second reason in The final test's section 2 is titled "Choosing flatters the pick", with the text "<n> candidate models were tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh data." <n> is the run's count (the AI's fitted attempts plus the grid's allowed combinations), never "dozens" typed into the page.
- Where "too close to call" is decided: TOO_CLOSE_RUNS = 0.5 is defined once, in one shared browser module both tabs import, and each comparison uses the one-decimal scores the page displays (0.49 is too close; exactly 0.5 is not). The server never decides "too close to call" and holds no copy of the threshold. Takeaway 1's "totals have risen" variant stays on the server and uses the existing large-bias rule, not this threshold.
