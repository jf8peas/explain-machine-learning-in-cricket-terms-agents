# Feature Specification: Intro Hero for the Working Tab

**Feature Branch**: `013-intro-hero` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-17
**Status**: Draft
**Input**: Replace the introduction at the top of the linear regression app's Working tab with the approved hero design in `specs/013-intro-hero/design/`: a breadcrumb, a headline asking where a T20 innings will finish, a real innings drawn as a cricket "worm" chart, a short "How good is the TV projection?" panel, and three steps explaining the experiment.

## Context

This changes the top of the Working tab (features 007 and 011). Visitors currently land on a lot of text and the purpose of the app is not immediately clear.

The approved design lives in `specs/013-intro-hero/design/`. `README.md` is the specification for layout, copy, chart behaviour and data; `intro-hero-c.html` is a visual reference only (a picture of the design, not something the page ships). **Where the two differ, the README wins.** This spec does not repeat the README's copy, axes or layout in full; it states what the feature must deliver and how it is checked.

The hero must communicate, in this order:

1. The app is part of the Explain Machine Learning in Cricket Terms site.
2. It is an experiment in solving a machine learning problem with an AI agent.
3. The problem is linear regression.
4. The goal is to predict a T20 first innings' final total from the score after 10 overs.
5. Success is judged against the TV projection and a know-nothing guess, and the visitor is shown how good the TV projection really is.

## Clarifications

### Session 2026-10-17

- Q: When does the panel say the TV projection "barely helps"? → A: When the TV's average miss is within 10% of the know-nothing guess's average miss; otherwise the panel states the improvement plainly.
- Q: When does the caption say the TV projection was "about its typical miss"? → A: When the innings' miss is within 25% of the TV's average miss, either side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the app at a glance (Priority: P1)

A first-time visitor lands on the Working tab. Under a breadcrumb and the tab bar they see a headline, a one-sentence lead, a worm chart of one real innings with the TV projection, the know-nothing guess and what actually happened, a panel saying how good the TV projection is, and three short steps. Below the hero, still visible on a laptop screen, is the model picker or graph.

**Why this priority**: It is the whole feature; the purpose of the app becomes clear without reading a wall of text.

**Independent test**: Show the page to a person for a few seconds without scrolling; they can say what is predicted, what it is compared against and roughly how good the TV projection is.

**Acceptance Scenarios**:

1. **Given** the Working tab loads, **Then** the breadcrumb, tab bar, header (eyebrow, headline, lead), chart card, "How good is the TV projection?" panel and three steps appear in the order the design README describes, with the chart before the panel and steps when the layout is a single column.
2. **Given** a viewport of 1280 × 800, **Then** the top edge of the model picker or graph container is visible without scrolling.
3. **Given** the worm chart, **Then** it shows the real cumulative runs for each of the 20 overs of the example innings, split at over 10 into the thick first-10-overs line and the thinner "what actually happened" line, with wicket markers, the 10-over dot and score label, the final-total marker, the TV projection line, the know-nothing line, the TV's typical-miss bar and the four stacked end labels, as the README specifies.
4. **Given** the end labels, **Then** they never overlap whatever the values are.
5. **Given** the chart, **Then** it has a text equivalent stating the innings, the score at 10 overs, the TV projection, the know-nothing guess, the actual total, the TV's average miss, and that the agent's prediction is unknown.
6. **Given** the hero, **Then** it contains no buttons or links to Play or to the Data tab; the breadcrumb's first item links to the main site.
7. **Given** light mode, dark mode, and a 360 px wide screen, **Then** the hero is readable, series are distinguishable by line style and label as well as colour, nothing animates, and there is no sideways page scroll.

---

### User Story 2 - Every sentence stays true to the figures (Priority: P1)

The caption, the panel sentence and the footnote are built from the server's figures, so they remain correct if the data, the goal or the example innings changes.

**Why this priority**: A hero that states "barely helps" or "too low" when the figures say otherwise would mislead; the page's credibility depends on it.

**Independent test**: Feed the hero different figures (TV bias flipped, TV far better than the know-nothing guess, this innings' miss much larger than the TV's typical miss) and check each sentence.

**Acceptance Scenarios**:

1. **Given** the TV projection's miss on the example innings is within 25% of the TV's average miss (either side), **Then** the caption says "about its typical miss"; **Given** it is not, **Then** that clause is omitted.
2. **Given** the TV's average miss is lower than the know-nothing guess's but by no more than 10% of the know-nothing guess's, **Then** the panel says knowing the score at 10 overs "barely helps"; **Given** the TV is more than 10% better, **Then** it does not say "barely helps" and instead states the improvement plainly; **Given** the TV is no better than the know-nothing guess (equal or worse), **Then** the panel says so plainly and never says "barely helps".
3. **Given** the TV's bias is below the actual totals, **Then** the panel says "too low"; **Given** above, "too high"; **Given** no meaningful bias, it makes no direction claim.
4. **Given** the goal margin, **Then** the "beat it by at least N runs" figure is the goal's margin as set for the app.
5. **Given** the footnote, **Then** the innings count and first and last years come from the reference figures.

---

### User Story 3 - Numbers come from the server, checked automatically (Priority: P1)

Every number in the hero comes from the server: reference figures from the introduction's existing endpoint and the example innings from the prepared data. None is typed into the page.

**Why this priority**: The figures are the evidence for the claim the hero makes.

**Independent test**: An automated check compares every number shown in the hero with the server's figures and the prepared data.

**Acceptance Scenarios**:

1. **Given** the hero is rendered, **Then** every number in the chart, labels, caption, panel and footnote equals the corresponding server figure or prepared-data value (TV and know-nothing average misses, TV bias, average total, innings count, year range, goal margin, teams, venue, date, runs and wickets at the end of each over, final total).
2. **Given** the prepared data, **Then** it records cumulative runs and wickets at the end of every over for at least the example innings.
3. **Given** the server settings name a fixed match id for the example innings (currently Australia v India, SCG, December 2020), **Then** the hero draws that innings; changing the id changes the innings without any page change.

---

### User Story 4 - Old introduction gone, everything else unchanged (Priority: P2)

The lead line and miss meter, the five chips, "How this works, in full", "Full figures for the two simple guesses" and "What the agent can choose from" no longer appear on the Working tab. Their content is not relocated in this feature.

**Why this priority**: It clears the space the hero needs and keeps the rest of the app safe.

**Independent test**: Search the Working tab for the removed elements; run the full existing test suite.

**Acceptance Scenarios**:

1. **Given** the Working tab, **Then** none of the removed elements or their content appears.
2. **Given** the model picker (with its one-line "runs can differ" note), graph, live summary line and all other tabs, **Then** they behave and look as before.
3. **Given** the existing test suite, **Then** all tests pass, with changes made only to tests that checked the removed introduction.

### Edge Cases

- The example match id is missing from the prepared data: the hero shows no broken chart and no invented numbers, and the fault is visible to developers.
- Reference figures unavailable or the request fails: no numbers are invented; the hero shows a plain unavailable state.
- A plotted value exceeds 200 runs: the y axis extends to fit it.
- A wicket in the same over as the 10-over dot or the final total: the marker is omitted, as the README says.
- Projection, know-nothing and actual values very close: end labels remain separate and legible.
- An innings shorter than 20 overs (all out early, or shortened): not supported; see Assumptions.
- TV bias or miss ordering reversed: sentences follow the data (User Story 2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Working tab MUST open with the hero described in `design/README.md`, in the order: breadcrumb, tab bar, header, two-column area (chart card; panel then steps), then the unchanged model picker, graph and live summary line.
- **FR-002**: The hero MUST communicate the five points in Context, in that order.
- **FR-003**: The worm chart MUST be drawn from the example innings' per-over cumulative runs and wickets, and show every element listed in the README's chart section.
- **FR-004**: End labels MUST be stacked so they never overlap for any values.
- **FR-005**: The chart MUST have a text equivalent covering the items in User Story 1, scenario 5.
- **FR-006**: The caption, panel sentence and footnote MUST be built from the data; every conditional clause ("about its typical miss", "barely helps", "too low" / "too high", goal margin) MUST be true for the figures shown and MUST change or disappear when they stop being true.
- **FR-007**: Every number in the hero MUST come from the server (the reference figures and the prepared data); none is hard-coded in the page.
- **FR-008**: Data preparation MUST record cumulative runs and wickets at the end of every over, at least for the example innings.
- **FR-009**: The example innings MUST be selected by a fixed match id in the server's settings.
- **FR-010**: The hero MUST NOT contain buttons or links to Play or the Data tab. The breadcrumb's site name links to the main site.
- **FR-011**: The lead line and miss meter, the five chips, "How this works, in full", "Full figures for the two simple guesses" and "What the agent can choose from" MUST be removed from the Working tab, with no replacement of their content.
- **FR-012**: The hero MUST add a TV-colour token with a dark-mode value keeping at least 4.5:1 contrast on the background, reuse the page's existing tokens, and use the system font stack.
- **FR-013**: The hero MUST work in light and dark mode and at 360 px wide with no sideways page scroll, in single-column order header, chart card, panel, steps; nothing animates.
- **FR-014**: At 1280 × 800 the top of the model picker or graph container MUST be visible below the hero.
- **FR-015**: The model picker, graph, live summary line and all other tabs MUST be unchanged; existing tests MUST pass, updated only where they checked the removed introduction.

### Key Entities

- **Reference figures**: TV average miss, know-nothing average miss, TV bias, average final total, innings count, first and last year, goal margin (existing, features 006 and 008).
- **Example innings**: match id, batting and bowling team, venue, date, runs and wickets at the end of each of the 20 overs, runs at 10 overs, final total (from prepared data).
- **Hero copy**: eyebrow, headline, lead, caption, panel sentence, footnote and steps, with data-dependent sentences derived from the figures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Shown the page for a few seconds without scrolling, a first-time visitor can say what the app predicts, what it is compared against, and roughly how good the TV projection is (judged by a person).
- **SC-002**: 100% of numbers in the hero match the server's figures and prepared data, verified by an automated check.
- **SC-003**: At 1280 × 800 the top of the model picker or graph container is visible without scrolling.
- **SC-004**: The hero shows correctly in light and dark mode and at 360 px with zero sideways page scroll, and its chart has a text equivalent.
- **SC-005**: Each data-dependent sentence is verified true by automated checks against at least three differing sets of figures.
- **SC-006**: The model picker, graph, live summary line and other tabs are unchanged, and the full existing test suite passes with edits only to tests of the removed introduction.

## Assumptions

- The README's numbers (22.5, 23.9, 14.3, 162, 2,133, 82/2, 186/5 and so on) are illustrative of 2026-10-17 and are not to be hard-coded.
- The example innings is a full 20-over innings; shortened or all-out-early innings are not supported by this feature.
- The removed content is reinstated elsewhere in a later feature; this feature does not move it.
- The tab bar from feature 011 is unchanged and appears directly under the breadcrumb.
- The main-site URL for the breadcrumb link already exists in the app or its configuration; if not, it is settled at planning time.
