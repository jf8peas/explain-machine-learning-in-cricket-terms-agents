# Feature Specification: How Good Is the Reference? Accuracy Against Real Totals

**Feature Branch**: `006-reference-accuracy` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-09
**Status**: Draft
**Input**: Show how good the broadcaster's projection really is against actual final totals, so visitors can judge whether beating it means anything, both in the introduction before a run and in the final test at the end.

## Context

This extends the linear regression agent app (features 001 to 005). The agent's goal is to beat the broadcaster's projected score (current run rate × 20 overs). That is the right goal, but visitors never see how accurate the projection itself is. If it is a poor prediction, a model that only just beats it is also poor.

The errors the page shows today are measured against actual final totals, but they have no sense of scale: a visitor cannot tell whether an average miss of, say, 15 runs is good or bad. Judging a model against several sensible reference points, rather than against a single rival, is one of the most useful habits the site can teach to its audience of cricket fans learning machine learning.

### Three references and the agent's models

| Name on the page | What it predicts | Where its numbers come from |
|---|---|---|
| **The know-nothing guess** | Every innings will end on the average final total of the training years, whatever the score at 10 overs | Code, from the training years only |
| **The broadcaster's projection** | Current run rate × 20 overs (the existing benchmark) | Code, from the score at 10 overs |
| **The language model's chosen model** | A straight-line model using the features the language model picked | Code, fitted on the training years |
| **Forward selection's model** | A straight-line model using the features forward selection picked | Code, fitted on the training years |

The know-nothing guess is the floor: any useful prediction must beat it. The broadcaster's projection is the bar the agent has to clear.

### How accuracy is described

For each method, against the actual final totals of the innings being scored, four things are shown, in plain cricket language with the technical name given once in brackets where it helps:

| Measure | Plain meaning | Technical name |
|---|---|---|
| **Average miss** | How many runs the guess is out by, on average, whichever way | mean absolute error |
| **Hit rate** | The share of innings guessed to within 10 runs ("within a boundary or two"), and to within 20 runs | share within a tolerance |
| **Miss as a share of a typical total** | The average miss as a percentage of the average actual total | relative error |
| **Bias** | Whether the method tends to guess too high or too low, and by how many runs on average | mean signed error |

Every figure is calculated by code from the data; none is typed into the page.

## Clarifications

### Session 2026-10-09

- Q: What is the goal the agent is judged against? → A: Keep the existing goal: beat the broadcaster's projection by at least 3 runs of average miss, on the test year. The verdict also reports the improvement as a percentage of the projection's average miss, beside the runs, as information; it is not a second target and does not change whether the goal was reached.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how good the bar is before running anything (Priority: P1)

Before pressing Play, a visitor reads how well the broadcaster's projection and the know-nothing guess did against actual final totals in past seasons, and sees how much the projection's knowledge of the score at 10 overs is worth.

**Why this priority**: This is the point of the feature: a visitor can only judge a result if they know how hard the target is.

**Independent test**: Load the page without running anything, read the introduction figures, and compare them with an independent calculation on the training years.

**Acceptance Scenarios**:

1. **Given** the page before any run, **Then** the introduction shows, for the know-nothing guess and the broadcaster's projection, the four accuracy measures against actual final totals, calculated on the training years only.
2. **Given** those figures, **Then** the introduction states plainly that this is the bar the agent has to clear and how good that bar is, and shows the gap between the know-nothing guess and the projection (in runs of average miss and in hit rate) so the value of knowing the score at 10 overs is visible.
3. **Given** the introduction, **Then** it is short: a brief passage and a compact comparison, and the Play control stays easy to reach.
4. **Given** the test year, **Then** none of the introduction's figures uses it; the test year is used once, in the final test.
5. **Given** the projection is barely better than, or worse than, the know-nothing guess, **Then** the introduction says so plainly instead of presenting the projection as a strong bar.

---

### User Story 2 - Compare every method side by side at the end (Priority: P1)

After a run, the final test scores four methods on the test year against actual final totals, each exactly once, and shows all the accuracy measures for each of them side by side.

**Why this priority**: The side-by-side comparison is how a visitor judges whether the winning model is actually good, not just ahead of one rival.

**Independent test**: Run the agent with the scripted stand-in model and compare every figure in the comparison with an independent calculation on the test year.

**Acceptance Scenarios**:

1. **Given** a finished run, **Then** the final results show, for the know-nothing guess, the broadcaster's projection, the language model's chosen model and forward selection's model, the average miss, both hit rates, the miss as a share of a typical total, and the bias, side by side.
2. **Given** the final test, **Then** each of the four methods is scored on the test year exactly once, and the test year is used nowhere else in the run.
3. **Given** the language model did not take part (feature 004's fallback), **Then** the comparison shows the three remaining methods and says plainly that the language model's model is absent.
4. **Given** every method that uses the score at 10 overs (the broadcaster's projection and the agent's models) has a large bias in the same direction, **Then** the results say so in words, rather than only showing the average miss.
5. **Given** the winning model beats the broadcaster's projection but not by the goal's margin, **Then** the verdict says so, as it does today.
6. **Given** the broadcaster's projection is barely better than, or worse than, the know-nothing guess on the test year, **Then** the results say so plainly beside the comparison; otherwise they say how much better it was.

---

### User Story 3 - See how tightly each method follows reality (Priority: P1)

A visitor sees a chart of predicted against actual final totals for the test year, with one dot per innings for each method they choose to show and a diagonal line marking a perfect prediction.

**Why this priority**: Numbers summarise; the chart shows what a miss looks like, including patterns (a method that always guesses low, one that scatters widely) that no single figure shows.

**Independent test**: Show each method in turn on the chart and check the dots against the underlying predictions and actual totals; check it in light and dark mode, at phone width, and without colour.

**Acceptance Scenarios**:

1. **Given** the final results, **Then** a predicted-versus-actual chart for the test year is shown, with a diagonal line where predicted equals actual, and the same scale on both axes.
2. **Given** the chart, **When** the visitor chooses which methods to show, **Then** it draws one dot per test innings for each chosen method, and removing a method removes its dots.
3. **Given** several methods are shown at once, **Then** they can be told apart without relying on colour (for example by marker shape) and the chart has a key.
4. **Given** the chart, **Then** it is readable in light and dark mode and at phone width, and its information is also available as text for a visitor who cannot see it.
5. **Given** the visitor has chosen no method, **Then** the chart shows only the diagonal and a prompt to choose a method.
6. **Given** the language model did not take part, **Then** its method is not offered on the chart.

---

### User Story 4 - A plain-language verdict against all three references (Priority: P2)

The explanation says, in cricket language, how the winning model compares with the know-nothing guess, the broadcaster's projection and actual totals, and sets honest expectations about what any method can do.

**Why this priority**: The numbers are only useful if the visitor can read them as a judgement; this turns them into one.

**Independent test**: Read the explanation after a run and check every figure in it against the results table.

**Acceptance Scenarios**:

1. **Given** a finished run, **Then** the explanation states by how much the winning model beats the know-nothing guess, by how much it beats the broadcaster's projection, and how often it lands within 10 runs of the real total.
2. **Given** the winner does not beat one of the references, **Then** the explanation says so plainly instead of omitting that reference.
3. **Given** the final results, **Then** near them the page says plainly that no method can predict a final total perfectly from the halfway mark, because what happens in the last 10 overs (collapses, a batter getting going, rain) is partly unpredictable, and that the aim is to be clearly better than the references, not perfect.
4. **Given** every figure in the explanation, **Then** it comes from code and equals the figure in the results table.

---

### User Story 5 - A clear goal (Priority: P2)

The goal the agent is trying to reach is stated in the introduction and judged in the final verdict, in the same terms in both places.

**Why this priority**: With three references on the page, the goal must say which one it is measured against and by how much, or the visitor cannot tell success from failure.

**Independent test**: Read the introduction's goal, run the agent, and check the verdict uses the identical goal.

**Acceptance Scenarios**:

1. **Given** the introduction, **Then** it states the goal: to beat the broadcaster's projection by at least 3 runs of average miss on the test year, which nothing was trained or chosen on.
2. **Given** a finished run, **Then** the final verdict judges the winning model against exactly that goal and says whether it was reached, and gives the improvement over the projection both in runs and as a percentage of the projection's average miss (for example "2.0 runs better, 9.6%: short of the 3-run goal"); the percentage is information only and never changes whether the goal was reached.
3. **Given** the goal is stated in more than one place (introduction, verdict, explanation), **Then** its wording and its numbers come from one source and cannot disagree.

---

### Edge Cases

- The broadcaster's projection is barely better than, or worse than, the know-nothing guess: the introduction and the results both say so plainly.
- The winning model beats the projection but not by the goal's margin: the verdict says so, as it does today.
- Every method that uses the score at 10 overs (the broadcaster's projection and the agent's models) has a large bias in the same direction: the results say so in words. The know-nothing guess is left out of this, because its bias is near zero by construction.
- The language model did not take part: the comparison and the chart cover the three remaining methods, and say the language model's model is absent.
- The visitor chooses no method on the chart: only the diagonal and a prompt are shown.
- Several methods' dots overlap heavily: the chart stays legible (dots are not opaque, so density shows) and no dot is hidden behind a key or axis.
- Two methods give exactly the same predictions (for example both choose the same features): both are listed, and the chart does not mislead by showing one dot where there are two.
- A method has a hit rate or bias that rounds to zero: it is shown as zero, not omitted.
- The test year has very few innings: the figures are still shown, with the number of innings they rest on, and the page does not claim more than that number supports.
- A narrow phone screen: the comparison scrolls or reflows without the page scrolling sideways, and the chart keeps both axes readable.
- Reduced motion: nothing about the chart or the comparison relies on animation.

## Requirements *(mandatory)*

### Functional Requirements

**The references**

- **FR-001**: A know-nothing guess is added as a reference. It predicts every innings will end on the average final total of the training years, ignoring the state of the innings at 10 overs, and is calculated by code from the training years only.
- **FR-002**: The know-nothing guess is shown alongside the broadcaster's projection and the agent's models wherever they are compared.

**The accuracy measures**

- **FR-003**: For every method compared, against the actual final totals of the innings being scored, the page shows the average miss in runs, the share of innings predicted within 10 runs and within 20 runs, the average miss as a percentage of the average actual total, and the bias (whether it guesses too high or too low, and by how many runs on average).
- **FR-004**: The measures are described in plain cricket language, with the technical name given once in brackets where it helps.
- **FR-005**: Every figure shown comes from a calculation by code on the data; none is typed into the page, and each equals an independent calculation.

**The introduction (before a run)**

- **FR-006**: Before any run, the introduction shows the know-nothing guess and the broadcaster's projection scored on the training years only, with all the measures in FR-003.
- **FR-007**: The introduction says plainly that this is the bar the agent has to clear and how good that bar is, and shows the gap between the know-nothing guess and the projection, so a visitor can see what knowing the score at 10 overs is worth.
- **FR-008**: The introduction is kept short: a brief passage and a compact comparison, so the graph and the Play control stay easy to reach.
- **FR-009**: If the projection is barely better than, or worse than, the know-nothing guess, the introduction says so plainly, and so do the final results (judged on the test year there).
- **FR-010**: No figure in the introduction uses the test year.

**The final test (at the end of a run)**

- **FR-011**: The final test scores, on the test year, against actual final totals, the know-nothing guess, the broadcaster's projection, the language model's chosen model and forward selection's model. Each is scored exactly once, and the test year is used nowhere else.
- **FR-012**: The final results show all the measures in FR-003 for each of the four methods side by side.
- **FR-013**: If the language model did not take part, the comparison covers the three remaining methods and says the language model's model is absent.
- **FR-014**: If every method that uses the score at 10 overs (the broadcaster's projection and the agent's models) has a large bias in the same direction, the results say so in words. The know-nothing guess is not counted, because its bias is near zero by construction.
- **FR-015**: Near the final results the page says plainly that no method can predict a final total perfectly from the halfway mark, because what happens in the last 10 overs (collapses, a batter getting going, rain) is partly unpredictable, and that the aim is to be clearly better than the references, not perfect.

**The predicted-versus-actual chart**

- **FR-016**: The final results include a chart of predicted against actual final totals for the test year, with one dot per innings for each method the visitor selects, a diagonal line marking a perfect prediction, and the same scale on both axes.
- **FR-017**: The visitor chooses which methods the chart shows. With no method chosen, it shows only the diagonal and a prompt to choose one. The language model's method is not offered when it did not take part.
- **FR-018**: The chart is readable in light and dark mode and at phone width, tells methods apart without relying on colour alone, has a key, shows overlapping dots legibly, and its information is available as text.

**The explanation and the goal**

- **FR-019**: The explanation states, in cricket language, by how much the winning model beats the know-nothing guess, by how much it beats the broadcaster's projection, and how often it lands within 10 runs of the real total. If it does not beat a reference it says so.
- **FR-020**: The goal is to beat the broadcaster's projection by at least 3 runs of average miss on the test year. It is stated in the introduction, judged in the final verdict, and described in the same words and numbers in every place it appears, from one source.
- **FR-021**: The verdict says whether the winning model reached the goal, gives the improvement over the broadcaster's projection in runs and as a percentage of the projection's average miss, and if it beat the projection but not by the goal's margin, says so. The percentage is information; reaching the goal depends only on the runs.

**Integrity**

- **FR-022**: The training years alone are used for the know-nothing guess and for every figure in the introduction. The test year is used once, in the final test, and nothing chosen or shown before it depends on the test year.
- **FR-023**: All existing playback behaviour, the stage display of feature 005, the leaderboard and the existing tests keep working.

### Key Entities

- **Method**: one of the four things compared (know-nothing guess, broadcaster's projection, language model's chosen model, forward selection's model), with a name and a way to produce a prediction for an innings.
- **Accuracy figures**: for one method on one set of innings, the average miss, hit rates within 10 and 20 runs, miss as a share of the average actual total, bias, and the number of innings they rest on.
- **Prediction record**: for one innings and one method, the predicted total and the actual total, from which the chart and the figures are drawn.
- **Goal**: the target the winning model is judged against, with one wording and one set of numbers used wherever it appears.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Before any run, a visitor can say how accurate the broadcaster's projection is against actual totals and whether it is much better than knowing nothing (judged by a person, as in earlier reader reviews).
- **SC-002**: After a run, a visitor can say how the winning model compares with the know-nothing guess, the broadcaster's projection and actual totals, in runs and in hit rate (judged by a person).
- **SC-003**: Every figure in the introduction, the results and the explanation comes from code and matches an independent calculation, checked automatically for all four methods.
- **SC-004**: The introduction's figures use only training years, and the test year is used exactly once, in the final test, checked automatically (a change to every test-year value changes no introduction figure).
- **SC-005**: The chart can be read in light and dark mode and at phone width, and each method can be told apart without relying on colour, checked by looking at it in greyscale and by an automated check that no two methods share a marker.
- **SC-006**: The goal's wording and numbers are identical in the introduction, the verdict and the explanation, checked automatically, and the percentage shown in the verdict equals the runs improvement divided by the projection's average miss.
- **SC-007**: The added introduction content does not push the Play control out of view on a standard laptop window (1280 by 800).
- **SC-008**: All existing tests still pass.

## Assumptions

- **Stopping rule unchanged**: today the goal is used only in the introduction's wording and the final verdict. The loop's stopping rule (feature 004: the model says it is finished, two rounds in a row bring no improvement, or the six-round cap) does not use it. This feature does not change the stopping rule, which is out of scope; wherever the brief says the goal is "used by the stopping rule", it is read as the goal being applied consistently in the introduction and the verdict.
- **What each method is scored on**: the introduction scores the know-nothing guess and the broadcaster's projection on the innings of the training years; the final test scores all four on the innings of the test year. The know-nothing guess is scored on the same years it averages in the introduction, which is a deliberate reference point rather than a model being validated.
- **Predictions are compared unrounded** with the actual totals when working out hit rates and averages; the page rounds only what it displays.
- **Hit rates are inclusive**: an innings predicted exactly 10 runs from the real total counts as within 10 runs.
- **Bias sign**: bias is the average of predicted minus actual, so a positive bias means the method guesses too high; the page says "too high" or "too low" in words and gives the size in runs.
- **Default chart selection**: the chart opens with the winning model and the broadcaster's projection selected, so the first view already makes a comparison; the visitor can add or remove any method, including removing all.
- **"Large bias"** is a bias whose size is a meaningful share of the average miss; the exact threshold is chosen when planning and applied the same way everywhere.
- **Plain language over precision**: "within a boundary or two" stands for within 10 runs in explanatory text, with the exact number always shown beside it.
- **The test year** is the one the agent already keeps for a single final test (feature 004); the introduction never reads it.
- **Stage display** (feature 005) is unaffected: the know-nothing guess is part of the existing "Frame the problem" and "Final assessment" steps, not a new step, so no new stage assignment is needed.

- **The page's name for the projection** is "the TV projection", which the page, its tests and the verdict already use; "the broadcaster's projection" is how this document and the technical note describe it.
- **A very small test year** is already ruled out: the run stops with a clear message if the validation year or the test year has fewer than 100 innings (feature 004), so the figures never rest on a handful of innings. The number of innings each figure rests on is still shown.
- **The large-bias finding** looks only at methods that use the score at 10 overs, so that it can actually apply; the know-nothing guess's bias is shown in the table like any other.

## Out of Scope

- New prediction methods beyond the know-nothing guess.
- Changing the features, the selection process, or the agent's stopping rule.
- Changes to the Data tab.
- Per-competition or per-season breakdowns of accuracy.
