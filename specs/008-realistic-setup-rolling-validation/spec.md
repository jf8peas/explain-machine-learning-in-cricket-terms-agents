# Feature Specification: A Realistic Setup and a Steadier Judge

**Feature Branch**: `008-realistic-setup-rolling-validation` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-09
**Status**: Draft
**Input**: Make the agent's setup choices more realistic and its judging more reliable: define which innings the agent is tested on, let the language model choose which past innings to learn from and how much to weight recent seasons, and judge every setup across several validation years instead of one.

## Context

This extends the linear regression agent (features 001 to 006). A review of the process found three gaps:

1. **The data mixes very different kinds of cricket.** Since 2019, when every ICC member country gained T20 international status, most T20 internationals in the data involve associate nations, so the test year is dominated by lopsided matches most fans never watch.
2. **Twenty years are pooled with equal weight**, although scoring and rules have changed (for example the IPL's Impact Player rule from 2023).
3. **Feature sets are chosen on a single validation year**, a noisy judge, so the winner partly reflects that one year's quirks.

The principle: **the language model may choose what to try, but never what problem is being solved or how its choices are judged.** The site owner fixes the problem, code fixes the judging, and the language model chooses the setup from bounded menus that code checks, as it checks features today.

The audience is cricket fans learning machine learning. This feature also introduces **hyperparameters** for the first time: the training window and the recency weighting are settings chosen before fitting, and the mechanical rival tunes them by grid search.

### What changes, in plain terms

- **The innings being predicted** are fixed by the site owner: every IPL innings, every BBL innings, and T20 international innings where both teams are ICC full members. The test year, every validation year and the introduction's reference figures all use this population.
- **Judging** uses three rolling checks instead of one validation year. With test year Y: train before Y−3 and check on Y−3; train before Y−2 and check on Y−2; train before Y−1 and check on Y−1. A setup's validation error is the average of the three.
- **The language model's proposal** grows from a list of features to a full setup: features, training window, recency weighting and which innings to train on.
- **The rival** (forward selection) searches the same menus, tuning the new settings by grid search.

## Clarifications

### Session 2026-10-09

- Q: What does the winning setup train on for the final test? → A: All years before the test year Y, with the setup's window and weighting applied relative to Y and its training-innings choice; then it is scored on Y.
- Q: Which innings does the know-nothing guess average? → A: In each check and in the final test, the test-population innings in the years before the year being scored; the introduction's figure uses the years before Y−3.
- Q: How is the winner chosen across the two methods? → A: By the lowest average validation error across both methods' best setups, decided before the test year is touched; a tie goes to the language model. (Until now the winner was chosen on the test year's error.)
- Q: Is the losing method still scored on the test year? → A: Yes. Both methods' best setups are fitted and scored once on the test year, so the results table keeps showing both models; the test year plays no part in choosing the winner.
- Q: What gives way if the rival's grid search is too slow? → A: Nothing in the search: the grid stays complete (every combination), and the plan must make each fit cheap enough to finish within the limit, proven by a test.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everyone is judged on the same, realistic innings (Priority: P1)

A visitor wants the figures to describe the cricket they actually watch. Every method, the agent's models, forward selection, the TV projection and the know-nothing guess, is scored on the same innings: the leagues and full-member internationals.

**Why this priority**: Without a fixed, sensible test population every other number on the page is about the wrong cricket.

**Independent test**: Check that the test innings, every validation innings and the introduction's figures all lie in the test population, and that the population sentence appears in the introduction.

**Acceptance Scenarios**:

1. **Given** the test population, **Then** it contains every IPL innings, every BBL innings, and the T20 international innings in which both teams are on the fixed list of twelve full members, and no other innings.
2. **Given** a run, **Then** every method is scored on exactly the same test innings, all in the population.
3. **Given** the introduction's reference figures (feature 006), **Then** they are worked out on test-population innings only.
4. **Given** the introduction, **Then** one plain sentence states what the test population is.
5. **Given** the list of full members, **Then** it is defined in one place and every part of the app uses that list.

---

### User Story 2 - A steadier judge (Priority: P1)

A visitor learns that one validation year is a noisy judge. Every setup is judged on three rolling checks, each using only earlier years, and the average error decides.

**Why this priority**: It makes the winner less a product of one year's quirks, and it is the lesson the feature teaches.

**Independent test**: Run a setup and check the three checks' years, their training years, and that changing the test year's values changes nothing before the final test.

**Acceptance Scenarios**:

1. **Given** a test year Y, **Then** the three checks are: train on years before Y−3 and check Y−3; train before Y−2 and check Y−2; train before Y−1 and check Y−1.
2. **Given** any check, **Then** it uses only years before the year it checks, and no check uses the test year.
3. **Given** any setup, from the language model or from forward selection, **Then** its validation error is the average of the three checks' errors, and each check's error is kept.
4. **Given** the language model, **Then** it cannot change how setups are judged.
5. **Given** a run, **Then** changing every value in the test year changes nothing before the final test.
6. **Given** the final test, **Then** the winning setup is fitted on all years before the test year, with its window and weighting applied relative to the test year and its training-innings choice, and then scored on the test year.
7. **Given** a check year with fewer test-population innings than the minimum, **Then** the run stops at the load step with a clear data error, as other unusable data does today.

---

### User Story 3 - The language model chooses a full setup (Priority: P1)

The language model proposes more than features: how many past years to learn from, whether recent seasons count more, and whether to learn from all innings or only the test population. Code checks every choice against fixed menus.

**Why this priority**: These are the realistic modelling choices a cricket analyst would argue about, and they are where the language model's cricket knowledge helps.

**Independent test**: Propose setups inside and outside the menus and check which are fitted, which are rejected and with what reason.

**Acceptance Scenarios**:

1. **Given** a proposal, **Then** it states the features (from the feature catalogue, as today), the training window (all available years, the last 10, the last 5 or the last 3 years before the year being checked), the recency weighting (none, gentle or strong) and the training innings (test-population innings only, or all innings including associate internationals).
2. **Given** a proposal with any value outside the menus, **Then** code rejects it before fitting, shows the reason, and nothing is fitted.
3. **Given** a setup identical to one already tried, **Then** it is rejected as a repeat.
4. **Given** a window or weighting, **Then** it applies within each check, relative to the year being checked.
5. **Given** a window that leaves too few training innings in some check, **Then** the proposal is rejected with the reason; a short window with all innings is allowed if every check keeps enough training innings.
6. **Given** two setups that differ only in an option with no effect (for example the strongest weighting on a 3-year window), **Then** both are allowed and both appear on the leaderboard.
7. **Given** its reasoning, **Then** the language model may refer to any part of the setup, in cricket language.
8. **Given** the model is asked to reason, **Then** it is also shown average final totals by year, innings counts by competition and year, and its earlier setups' errors in each of the three checks, none of which uses the test year.

---

### User Story 4 - A fair rival, and a first look at hyperparameters (Priority: P2)

Forward selection searches the same menus, so the comparison with the language model is fair, and the visitor meets the idea of a hyperparameter.

**Why this priority**: Without it the rival would be handicapped, and the comparison unfair.

**Independent test**: Count the combinations forward selection tries and check the page's wording about hyperparameters.

**Acceptance Scenarios**:

1. **Given** forward selection, **Then** it tries every combination of training window, recency weighting and training innings in the menus, selecting features within that search, all judged by the same rolling validation.
2. **Given** the page, **Then** it names the training window and recency weighting as hyperparameters, explains in one or two plain sentences that they are settings chosen before fitting rather than learned from the data, and says this is the first time the site shows hyperparameter tuning.
3. **Given** the full run, including the rival's search, **Then** it still completes within the time limit set by feature 004.
4. **Given** the language model does not take part (feature 004's fallback), **Then** forward selection's grid search still runs and the results say the language model was absent.

---

### User Story 5 - The visitor can read the winning setup (Priority: P2)

The leaderboard, the final results and the explanation show each setup in full and in cricket language.

**Why this priority**: The new choices matter only if the visitor can see what was chosen and how it did.

**Independent test**: After a run, read a leaderboard entry and the final explanation.

**Acceptance Scenarios**:

1. **Given** the leaderboard, **Then** each entry shows the full setup (features, window, weighting, training innings), the average validation error, and the error in each of the three checks.
2. **Given** the final results and explanation, **Then** they state the winning setup in cricket language, for example "learned from the last 5 seasons, with recent seasons counting more, using full-member and league innings only".
3. **Given** the visitor reads the result, **Then** they can tell which seasons and innings the winner learned from, how recent seasons were weighted, and its error in each of the three checks.

---

### User Story 6 - The data carries what the new choices need (Priority: P2)

The data preparation records team membership, the Data tab shows it, and the machine learning stages describe the new split.

**Why this priority**: The population and the new candidate features rest on these columns, and the page's other parts must stay correct.

**Independent test**: Check the new columns' values, their presence on the Data tab and in the downloads, the manifest, and the stage wording.

**Acceptance Scenarios**:

1. **Given** the preparation script, **Then** every innings records the batting team, the bowling team, whether each is a full member, and whether the innings is in the test population.
2. **Given** the feature catalogue, **Then** full-member status is available as candidate features (for example "batting team is a full member" and "both teams are full members") with plain descriptions.
3. **Given** the Data tab, **Then** the new columns appear with descriptions, sort and filter like other columns, and are in the CSV downloads.
4. **Given** the manifest, **Then** it records the full-member list used and the number of innings in and out of the test population.
5. **Given** the Data tab's "Used for" column, **Then** it reads Test for the test year, "Training and validation" for the three check years and Training for earlier years, and a separate column shows whether each innings is in the test population.
6. **Given** the machine learning stages (feature 005), **Then** the split stage describes the three checks and the loop note names the actual years used.
7. **Given** a team name that differs between source files for the same country, **Then** it is mapped to one name before full-member status is decided, and any unmatched team name is reported by the preparation script.

---

### Edge Cases

- A training window that leaves too few innings in some check: rejected with the reason.
- All innings with a short window: allowed when every check keeps enough training innings.
- Two setups differing only in an option with no effect: both allowed, both on the leaderboard.
- The language model is absent: the grid search still runs and the results say so.
- A team name spelt differently in different source files: mapped to one name; any unmatched name is reported.
- A check year with too few test-population innings: the run stops at the load step with a clear data error.
- The data has fewer years than the rolling checks need: stops at the load step with a clear data error.
- A proposal naming only some parts of the setup: the missing parts are rejected with the reason (the setup is a full one), not silently defaulted.

## Requirements *(mandatory)*

### Functional Requirements

**The innings being predicted**

- **FR-001**: The test population is every IPL innings, every BBL innings, and every T20 international innings where both teams are ICC full members.
- **FR-002**: The full members are one fixed, named list: Afghanistan, Australia, Bangladesh, England, India, Ireland, New Zealand, Pakistan, South Africa, Sri Lanka, West Indies, Zimbabwe. It is defined once, and every part of the app uses that list.
- **FR-003**: The test year, every validation year and the introduction's reference figures use the test population, so every method is always scored on the same kind of innings.
- **FR-004**: The introduction states the test population in one plain sentence.

**Data preparation and the Data tab**

- **FR-005**: The data preparation records for every innings the batting team, the bowling team, whether each is a full member, and whether the innings is in the test population.
- **FR-006**: Full-member status is available as candidate features (including "batting team is a full member" and "both teams are full members") with plain descriptions in the feature catalogue.
- **FR-007**: The new columns appear on the Data tab with descriptions, sort and filter like other columns, and are in the CSV downloads.
- **FR-008**: The manifest records the full-member list used and how many innings are in and out of the test population.
- **FR-009**: Team names that differ between source files for the same country are mapped to one name before full-member status is decided; any unmatched team name is reported by the preparation script.

**Rolling validation**

- **FR-010**: Validation uses three rolling checks. With test year Y: train on years before Y−3 and check on Y−3; train on years before Y−2 and check on Y−2; train on years before Y−1 and check on Y−1. A setup's validation error is the average of the three checks.
- **FR-011**: Every check uses only years before the year it checks. The test year is not used until the final test.
- **FR-012**: Every setup proposed by the language model or tried by forward selection is judged this way, and the language model cannot change how it is judged.
- **FR-013**: Each check requires a minimum number of test-population innings, defined once. If any check year falls short, the run stops at the load step with a clear data error.

**The setup the language model chooses**

- **FR-014**: A proposal is a full setup: features (from the catalogue); training window (all available years, the last 10, the last 5, or the last 3 years before the year being checked); recency weighting (none, gentle or strong, where recent seasons count more when fitting, with the strengths fixed and defined once); and training innings (test-population innings only, or all innings including associate internationals).
- **FR-015**: Code rejects any proposal with a value outside the menus, or with a part missing, as it rejects unknown features today, and shows the reason. A setup identical to one already tried is rejected as a repeat. Nothing rejected is fitted.
- **FR-016**: The window and the weighting apply within each check, relative to the year being checked. A proposal that leaves too few training innings in any check is rejected with the reason.
- **FR-017**: The language model is also given: average final totals by year, innings counts by competition and year, and its earlier setups' errors in each of the three checks. None of this uses the test year.
- **FR-018**: The language model's reason may refer to any part of the setup, in cricket language.

**The rival**

- **FR-019**: Forward selection searches the same menus. It tries every combination of training window, recency weighting and training innings, selecting features within that search, all judged by the same rolling validation.
- **FR-020**: The page names the training window and the recency weighting as hyperparameters, explains in one or two plain sentences that they are settings chosen before fitting rather than learned from the data, and says this app is the first time the site shows hyperparameter tuning. The explanation is shown in the Choose-the-setup stage note and repeated in one line with the grid, so a visitor who never opens the stage note still sees it.
- **FR-021**: The full run, including the rival's search, still completes within the time limit set by feature 004. The search is never cut short or reduced to fit: every combination is tried, and the plan makes each fit cheap enough, shown by an automated timing check.
- **FR-022**: When the language model does not take part, forward selection's grid search still runs and the results say the language model was absent.

**What the visitor sees**

- **FR-023**: Each leaderboard entry shows the full setup (features, window, weighting, training innings), the average validation error, and the error in each of the three checks.
- **FR-024**: The final results and the explanation state the winning setup in cricket language.
- **FR-025**: The Data tab's "Used for" column reads Test for the test year, "Training and validation" for the three check years, and Training for earlier years; a separate column shows whether each innings is in the test population.
- **FR-026**: The machine learning stages from feature 005 stay correct: the split stage describes the three checks, and the loop note names the actual years used.

**Everything else**

- **FR-027**: Existing tests are updated only where the split or the population has deliberately changed; all others still pass.
- **FR-028**: Nothing else changes: the broadcaster's projection, the know-nothing guess, the goal of beating the projection by 3 runs, and the target being predicted.

**The final test, the guess and the winner**

- **FR-029**: For the final test, the winning setup is fitted on all years before the test year, with its training window and recency weighting applied relative to the test year and its training-innings choice, and is then scored on the test year only.
- **FR-030**: The know-nothing guess, wherever it is scored, is the average final total of the test-population innings in the years before the year being scored (in each check, in the final test, and, for the introduction, before the first check year Y−3).
- **FR-031**: The winner is the setup with the lowest average validation error across both methods' best setups, decided before the test year is touched; a tie goes to the language model. The test year plays no part in choosing the winner.
- **FR-032**: Both methods' best setups are fitted and scored once on the test year, so the side-by-side results (feature 006) keep showing both models; which one is the winner was already decided on validation error.

### Key Entities

- **Test population**: the innings the whole app is judged on: leagues, plus internationals between full members.
- **Full member**: one of twelve named teams on a single fixed list.
- **Rolling check**: one train-and-check round on one earlier year, using only years before it.
- **Setup**: features, training window, recency weighting and training innings, which together define one fitted model.
- **Hyperparameter**: a setting chosen before fitting rather than learned from data; here the training window and the recency weighting (and, in the grid search, the training innings).
- **Setup result**: a setup with its three check errors and their average.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every method is scored on exactly the same test innings, all in the test population, checked automatically.
- **SC-002**: No validation check uses data from the year it checks or any later year, and the test year is used only in the final test; changing every test-year value changes nothing before the final test, checked automatically.
- **SC-003**: A proposal outside the menus, or with a part missing, is never fitted, checked automatically.
- **SC-004**: Forward selection considers every combination of window, weighting and training innings in the menus (24 today), fitting each one that has enough training innings, checked by counting the combinations considered and fitted.
- **SC-005**: A visitor can read, for the winning setup, which seasons and innings it learned from, how recent seasons were weighted, and its error in each of the three checks (judged by a person, as in earlier reader reviews).
- **SC-006**: A run with the default language model finishes within feature 004's time limit, checked automatically with the scripted model and, once, with a live model.
- **SC-007**: The introduction's reference figures equal an independent calculation on the test population, checked automatically.
- **SC-008**: Every innings in the data carries its team names and membership flags, and the manifest's counts equal the counts in the data, checked automatically.
- **SC-009**: The Data tab's "Used for" values match the three check years, the test year and the earlier years, checked automatically.
- **SC-010**: All existing tests still pass, with only those that depend on the old single validation year or the old population updated.

## Assumptions

- **Test year and check years** follow the data: the test year is the latest calendar year in the data (as today), and the check years are the three years immediately before it.
- **The minimum innings per check** is one fixed number defined once; the plan chooses it from the real counts, so that the three check years of the committed data pass and the data error is real for a much thinner year.
- **The minimum training innings per check** (the least a setup's window and training-innings choice may leave in any check) is a second fixed number defined once; the plan chooses it from the real counts.
- **Afghanistan** is on the fixed list of full members but does not appear in the source data (Cricsheet's T20 internationals file has no Afghanistan innings), so no innings involving it can be in the data; the preparation script and a test record this gap rather than treating it as a failure.
- **Recency strengths** (gentle and strong) are fixed settings defined once; the plan chooses them and records them.
- **The training innings choice** "all innings" means every innings in the data before the checked year, including associate internationals; "test-population only" means leagues and full-member internationals.
- **"Equal to a setup already tried"** compares all four parts of the setup, with the features as a set (order does not matter).
- **The introduction's figures** (feature 006) are worked out on test-population innings in the years before the first check year (Y−3), so they stay independent of every validation year and of the test year.
- **The goal's value and wording** (feature 006, feature 007) are unchanged; the figures behind the TV projection's miss change because the population changes, and the meter follows them automatically.
- **Hyperparameter wording** is typed page copy and contains no figures; every number on the page still comes from the code.
- **The time limit** is feature 004's run deadline; the plan decides how each fit is made cheap enough for the complete search to finish inside it.

## Out of Scope

- Confidence ranges for results, coefficient stability or regularisation, and error breakdowns by competition or score range (a separate analysis feature).
- Team-strength ratings beyond full-member status, venue effects, and changing the target being predicted.
- Changing the broadcaster's projection, the know-nothing guess, or the goal of beating the projection by 3 runs.
