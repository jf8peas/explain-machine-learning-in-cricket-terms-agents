# Feature Specification: "What the agent found" Tab Redesign

**Feature Branch**: `014-found-tab` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-19
**Status**: Draft
**Input**: Redesign the "What the agent found" tab of the linear regression app so it explains the contest it shows, following the approved design in `specs/014-found-tab/design/`.

## Context

This changes the "What the agent found" tab (features 004, 008, 011). Today it shows a leaderboard, the rival's grid search and the model's reasoning as separate blocks with headings that only name them. Visitors cannot tell that they are two contestants and a scoreboard, what "forward selection" is, why there is a rival, or what the "Each check year" column means.

The approved design lives in `specs/014-found-tab/design/`. `README.md` is the specification for layout, copy, chart and grid behaviour and data; `found-tab.html` is a visual reference only (a picture of the design, not something the page ships; every figure, round, quoted reason and candidate model in it is a placeholder). **Where the two differ, the README wins.** This spec does not repeat the README's copy in full; it states what the feature must deliver and how it is checked.

The tab becomes a header (no eyebrow) followed by six numbered sections with one heading style, none collapsible:

1. The contest: the AI agent and the rival, defined, with why the rival exists and what a candidate model is.
2. How every candidate model is scored: a strip of learning, check and test seasons.
3. The race: a chart of the AI's rounds against the rival's best and the TV projection, plus a panel naming the candidate model that goes forward to the final test.
4. The AI's rounds: one card per round merging proposal, reason (the AI's own words) and result.
5. The rival's grid search: one small grid per training-innings choice, best cell starred, "hyperparameters" and "grid search" explained.
6. Every candidate model tried, ranked.

**Removed**: the leaderboard's "Each check year (runs)" column (section 2 explains what the average miss is made of), and the "The model's reasoning" block (replaced by section 4, which still shows every reason exactly as written, as text).

**Unchanged**: the other tabs, the graph and the live summary line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the contest after a run (Priority: P1)

After a run, a visitor with no machine learning background opens the tab and reads down the six sections. They can say what each contestant is, why the rival exists, how a candidate model's score is worked out, and which candidate model goes forward to the final test and by how much.

**Why this priority**: It is the purpose of the feature; the tab exists to make the contest legible.

**Independent test**: Show the finished tab to a person with no machine learning background and ask the four questions; they answer correctly (judged by a person).

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the tab is opened, **Then** it shows the header (heading and lead, no eyebrow) and sections 1 to 6 in order, each with a numbered heading in the same style, and no section can be collapsed.
2. **Given** section 1, **Then** two cards (the AI agent, the rival) each state what the contestant is and how it searches, the AI card shows the round cap, the rival card shows the number of grid combinations, and a strip below explains why there is a rival and what a candidate model is.
3. **Given** section 2, **Then** a strip shows the learning seasons, one segment per check season and a distinct "final test, locked" segment, with years taken from the run's split, and text explains that the score is the average miss across the check seasons.
4. **Given** section 3, **Then** the winner panel names whose candidate model goes forward, states each side's average miss and the gap, says the choice was made before the final test season was touched, and links to the final test tab.
5. **Given** a tie between the AI and the rival, **Then** the panel says it was a tie and that the AI's candidate model goes forward.
6. **Given** section 6, **Then** the table lists the AI's tries and the rival's best from each grid cell ordered by average miss, with columns #, Candidate model, Found by, Average miss and no per-season column, followed by the TV projection's average miss on the same seasons.

---

### User Story 2 - Follow the race and each AI round (Priority: P1)

The visitor sees how the AI's rounds compared with the rival and the TV projection, and for each round what the AI proposed, why, and how it went.

**Why this priority**: This is the evidence behind the winner; it also preserves the transparency of the AI's reasoning.

**Independent test**: Compare every chart mark, round card and the AI-reasoning text against the run's recorded rounds.

**Acceptance Scenarios**:

1. **Given** the race chart, **Then** it plots one mark per AI round (filled dot for a new best, open dot for no better, a cross labelled "rejected", the word "done" or "failed" where relevant), a solid line for the AI's best so far, a dotted line at the rival's best and a dashed line at the TV's average miss, each labelled with its value, with end labels that never overlap.
2. **Given** the race chart, **Then** it has a text equivalent giving every round's outcome and score, the rival's best and the TV's.
3. **Given** section 4, **Then** each round has one card with the round number, the proposal (clues, what changed from the previous round, other candidate model parts in plain words), the AI's reason as a quotation, and the result (average miss with "new best" and drop, "no better", "first score", "Rejected" with code's reason, "stopped", or "failed" with the reason).
4. **Given** the AI's reasons, **Then** they appear exactly as the AI wrote them, as text and never interpreted as markup.
5. **Given** the round that produced the AI's best, **Then** its card is outlined in the AI colour; rejected rounds are visibly distinct (dashed and greyed).

---

### User Story 3 - Understand the rival's grid search (Priority: P2)

The visitor sees why the rival tries every combination of settings, what the combinations are, and which one did best.

**Why this priority**: Explains the yardstick, but the race and winner carry the headline.

**Independent test**: Check each grid cell value and the starred best cell against the run's grid result.

**Acceptance Scenarios**:

1. **Given** section 5, **Then** the lead explains "hyperparameters" and "grid search" in plain words.
2. **Given** the grids, **Then** there is one small grid per training-innings choice, rows are training windows, columns are recency weightings, and each cell prints the best average miss found for that combination.
3. **Given** the cells, **Then** shading follows value (darker is smaller miss) but the value is always printed, and the best cell is outlined, bold and starred.
4. **Given** the line below the grids, **Then** it states the rival's best value, the winning cell's settings in plain words and its clues.
5. **Given** the grid labels, **Then** they come from the setup menus' plain labels, not text typed into the page.

---

### User Story 4 - Watch the tab fill in as the replay advances (Priority: P2)

As the replay advances, the tab fills in step by step as it does today. Before the winner is decided, the winner panel says the search is still going.

**Why this priority**: Preserves existing behaviour the visitor relies on.

**Independent test**: Step the replay and confirm each section shows only what has happened so far, and the winner panel changes only once the winner decision exists.

**Acceptance Scenarios**:

1. **Given** the replay is part-way through, **Then** only the rounds and attempts so far appear; the rival's grid, its line on the chart and its rows in the ranking appear together once the grid-search step is reached; and until then the winner panel says the search is still going.
2. **Given** the winner decision is recorded, **Then** the panel switches to the winner view.

---

### User Story 5 - Language model does not take part (Priority: P2)

**Why this priority**: A known fallback the tab must handle without breaking.

**Independent test**: Run with no language model and inspect the tab.

**Acceptance Scenarios**:

1. **Given** the language model did not take part, **Then** the AI card says so with a one-line reason, the race chart shows only the rival's and the TV's lines, section 4 is one sentence saying the AI made no proposals, and the winner panel names the rival.

---

### Edge Cases

- A run where every AI proposal was rejected, or the AI finished or failed in the first round (so there are no fitted AI attempts): the chart still plots, with no AI best line, section 4 still shows each round's card, and the winner panel names the rival.
- Only one fitted round: it is labelled "first score" and has no drop.
- Very close or tied values: the gap is stated correctly (including zero) and the tie rule applies. The recorded winner decision is never overridden: if the two bests display the same value but the recorded winner is the rival, the panel names the rival and says the gap is smaller than the display shows; the tie wording is used only when the displayed values are equal and the recorded winner is the AI.
- Long reasons or candidate models wrap inside their cards; nothing causes sideways page scroll at 360 px.
- All chart values equal, or a single round: the chart range still fits every plotted value.
- Reasons containing markup characters are shown literally.
- A grid with a single training-innings choice shows one grid, with no empty placeholders.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tab MUST show a heading and lead with no eyebrow, followed by six numbered sections with one shared heading style, none collapsible.
- **FR-002**: Section 1 MUST define the AI agent and the rival, state the round cap and the number of grid combinations, and explain why there is a rival and what a candidate model is.
- **FR-003**: Section 2 MUST show the learning, check and test seasons from the run's split and explain that a candidate model's score is its average miss across the check seasons, with the final test locked.
- **FR-004**: Section 3 MUST show the race chart described in the design README and a winner panel naming the candidate model that goes forward, both best misses and the gap, with a link to the final test tab.
- **FR-005**: The race chart MUST have a text equivalent covering every round's outcome and score, the rival's best and the TV's average miss.
- **FR-006**: Section 4 MUST show one card per round combining proposal, the AI's reason verbatim as text, and result, with the best, rejected, finished and failed rounds distinguished as the README describes.
- **FR-007**: Section 5 MUST show one grid per training-innings choice, print every cell's value, mark the best cell with outline, bold and star, and explain "hyperparameters" and "grid search".
- **FR-008**: Section 6 MUST list all AI attempts and the rival's best per grid cell ordered by average miss, with the Found by column in words, and MUST NOT include a per-season column.
- **FR-009**: Every number and candidate model description MUST come from the run's state and the server's settings: the round cap, grid combination count, split years, rounds, attempts, grid result, TV projection's average miss on the check seasons and the winner decision made before the final test. None may be typed into the page.
- **FR-010**: The tab MUST fill in step by step as the replay advances; before the winner is decided the winner panel MUST say the search is still going.
- **FR-011**: When the language model does not take part, the tab MUST follow the README's fallback (AI card says so, chart shows rival and TV only, section 4 is one sentence, winner panel names the rival).
- **FR-012**: Method colours MUST always be paired with words or shapes.
- **FR-013**: The tab MUST work in light and dark mode and at 360 px wide with no sideways page scroll (the ranking table may scroll inside its own box); nothing animates.
- **FR-014**: The other tabs, the graph and the live summary line MUST be unchanged, and all existing tests MUST pass, updated only where they checked the old leaderboard, grid or reasoning blocks.

### Key Entities

- **Run**: the replayed experiment: its split of seasons, rounds, attempts, grid result, TV projection result and winner decision.
- **Round**: one AI turn: proposal, reason (verbatim), outcome (fitted, rejected, finished or failed), code's message and, if fitted, average miss.
- **Attempt / Candidate model**: a fitted combination of clues and settings with its average miss, who proposed it, and whether it set a new best.
- **Grid result**: the rival's best average miss for each combination of training-innings choice, training window and recency weighting, with the best cell, its candidate model and clues.
- **Winner decision**: which side goes forward, both best misses, made before the final test.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a run, a visitor with no machine learning background can say what each contestant is, why the rival exists, how a candidate model's score is worked out, and which candidate model goes forward and by how much (judged by a person).
- **SC-002**: Every number on the tab matches the run's state, checked automatically across a run with the language model, a run without it, and a mid-replay state.
- **SC-003**: No method is identified by colour alone: every coloured element has an adjacent word or shape, verified by automated and visual check.
- **SC-004**: The tab is readable in light and dark mode and at 360 px wide with no sideways page scroll.
- **SC-005**: The race chart has a text equivalent containing every round's outcome and score, the rival's best and the TV's.
- **SC-006**: The other tabs, the graph and the live summary line are unchanged, and the full existing test suite passes, with tests changed only where they checked the old leaderboard, grid or reasoning blocks.

## Assumptions

- The design README's copy is the source of truth for wording; where it contains placeholders, the run supplies the values.
- The TV colour token from feature 013 and the method colour tokens already exist and are reused.
- "Tie" and "winner" follow the existing winner rule; this feature only presents the decision.
- The final test tab already exists and can be linked to.
