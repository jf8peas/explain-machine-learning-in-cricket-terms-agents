# Feature Specification: A Lighter Goal Section (the "Miss Meter")

**Feature Branch**: `007-goal-section-redesign` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-09
**Status**: Draft
**Input**: Redesign the introduction's goal section at the top of the linear regression page so it says the same thing with far less reading. The approved design is in `specs/007-goal-section-redesign/design/`: `README.md` is the specification for layout, colours, copy and data, and `goal-section-1a.html` is the visual reference. The reference file is a picture of the design, not something the page ships.

## Context

This changes the introduction at the top of the linear regression page (features 001 to 006). Today it has two long paragraphs side by side, then the goal beside a table of figures and three sentences about how good the TV projection is. A first-time visitor has to read about 260 words before reaching the graph, and the one thing they most need to understand, what the agent is trying to beat and by how much, is spread across all of it.

The redesign says the same thing with far less reading. A single lead sentence states the challenge. A **miss meter**, a number line of average miss where lower is better, shows three marks: the know-nothing guess, the TV projection, and the goal. A row of five short labelled chips introduces the terms. The long explanation and the table of figures are not removed: they move into two collapsed sections that a curious visitor can open.

Nothing about the goal, the figures or how they are worked out changes. Only how the introduction shows them changes.

### What the visitor sees, top to bottom

1. The eyebrow and the page title, unchanged.
2. **One lead line**: "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by 3 runs less on average." The 3 is the goal's margin from the server.
3. **The miss meter**: a horizontal number line of average miss in runs, better on the left. Three marks: the **know-nothing guess**, the **TV projection** and **the goal**, each with its name and its value. The goal is the TV projection's average miss minus the margin. The stretch of the line that beats the goal is shaded. A caption gives the training years and the number of innings, and a footer restates the goal and that the latest calendar year is held out.
4. **A row of five chips**: Agent, Language model, Code, Linear regression, Rival (forward selection), each a bold term with a few words.
5. **Two sections closed by default**: "How this works, in full" holds the two existing introduction paragraphs word for word; "Full figures for the two simple guesses" holds the existing table and the existing sentences about it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grasp the challenge at a glance (Priority: P1)

A visitor lands on the page and, without reading paragraphs, sees what the agent has to beat and how far away it is: where knowing nothing sits, where the TV projection sits, and where the goal sits on one line.

**Why this priority**: This is the whole point of the redesign: the same message in far less reading.

**Independent test**: Load the page with both closed sections left closed and check the lead line, the three marks with their values, the shaded goal zone and the footer.

**Acceptance Scenarios**:

1. **Given** the page has loaded, **Then** below the title there is one lead line stating that the agent tries to beat the TV projected score by missing by the goal's margin fewer runs on average, with the margin taken from the server.
2. **Given** the miss meter, **Then** it has three marks, each with a name and a value: the know-nothing guess and the TV projection (their average misses on the training years) and the goal (the TV projection's average miss minus the margin, to one decimal place, worked out from the displayed figures).
3. **Given** the three marks, **Then** each sits at a position on the line proportional to its value, a lower value is further left (better), and the stretch of the line from the left end to the goal is shaded to show where beating the goal lies.
4. **Given** the meter, **Then** its caption gives the training years and the number of innings the figures rest on, and its footer states the goal and that the latest calendar year, which nothing was trained or chosen on, is where it is judged.
5. **Given** the scale of the line, **Then** it is worked out from the three values so that every mark, its name and its value are fully visible whatever the data, never cut off at either end.

---

### User Story 2 - The detail is there, but out of the way (Priority: P1)

A visitor who wants the full explanation or the exact figures can open them; everyone else is not made to read them.

**Why this priority**: Removing the long text would lose information; collapsing it keeps everything and cuts the reading.

**Independent test**: Check both sections start closed, open each, and compare their contents with the old introduction.

**Acceptance Scenarios**:

1. **Given** the page has loaded, **Then** both sections ("How this works, in full" and "Full figures for the two simple guesses") are closed, and the words inside them are not visible.
2. **Given** the first section is opened, **Then** it holds the two existing introduction paragraphs exactly as they are today, word for word.
3. **Given** the second section is opened, **Then** it holds the existing sentence about how well the two simple guesses did, the existing table of figures (the same columns and the same figures as today) and the existing sentences about the gap, all unchanged.
4. **Given** a row of five chips between the meter and the sections, **Then** they read: Agent (a LangGraph graph of steps), Language model (picks features), Code (makes every number), Linear regression (runs per unit), Rival (forward selection); the language-model chip is marked in the page's accent colour, and the chips wrap onto more lines on a narrow screen rather than overflowing.
5. **Given** a visitor opens or closes a section, **Then** nothing else on the page moves unexpectedly and nothing animates.

---

### User Story 3 - Everyone can read it (Priority: P2)

The meter works for people who cannot see colour or cannot see the picture, and in both light and dark mode.

**Why this priority**: A chart that only some visitors can read would not make the page lighter for everyone.

**Independent test**: Read the meter's text equivalent; view the page in greyscale and in dark mode; use the keyboard on the two sections.

**Acceptance Scenarios**:

1. **Given** the meter, **Then** it has a text equivalent that states all three values and what they mean, for example "Average miss: know-nothing 29.4, TV projection 21.8, goal 18.8 or less", worked out from the same figures.
2. **Given** the three marks, **Then** they are told apart by their names, their values and their shapes (a dot for the two references, a vertical line for the goal), never by colour alone.
3. **Given** dark mode, **Then** every part of the section uses the page's own light-and-dark colours, text stays readable (at least 4.5 to 1) and the marks, the line and the shaded zone's border stand out from the background (at least 3 to 1); the zone's fill is decoration behind a bordered, labelled zone and is not held to that ratio.
4. **Given** the keyboard, **Then** each closed section can be reached, opened and closed, with a visible focus indicator.
5. **Given** the region that fills in after the figures arrive, **Then** it still announces its content politely to screen readers, as the introduction's figures do today.

---

### User Story 4 - It works on a phone (Priority: P2)

On a small screen the meter, the chips and the sections stay readable and nothing runs off the screen.

**Why this priority**: Much of the audience reads on a phone.

**Independent test**: Load the page at 360, 390 and 768 pixels wide and check for overlap, clipping and sideways scrolling.

**Acceptance Scenarios**:

1. **Given** a screen as narrow as 360 pixels, **Then** the page does not scroll sideways, and every mark's name and value is fully inside the meter's card.
2. **Given** a narrow screen, **Then** no mark's name or value overlaps another's, even when two values are close together; labels may wrap onto two lines or be staggered to avoid it.
3. **Given** a screen narrower than 760 pixels, **Then** the values on the marks are a little smaller and the "better" and "worse" end labels are dropped so they cannot collide with the caption.
4. **Given** a narrow screen, **Then** the chips wrap and the opened table scrolls inside its own box without making the page scroll.

---

### User Story 5 - Honest when the figures are missing (Priority: P2)

If the figures cannot be loaded, the section does not show invented numbers.

**Why this priority**: The meter's numbers exist only on the server; showing placeholders would be misleading.

**Independent test**: Make the figures request fail, and separately return no figures, and check what shows.

**Acceptance Scenarios**:

1. **Given** the request for the figures fails, **Then** the lead line, the meter and the goal are not shown, and the existing short message that the goal and figures could not be loaded is shown instead; the rest of the page works.
2. **Given** the server answers but has no figures (the data could not be read), **Then** the meter is not drawn, the message says the figures could not be loaded, and the section of full figures is not shown (it would be empty); the lead line and a plain goal line still show, because they need no figures.
3. **Given** the figures have not arrived yet, **Then** the meter area is empty and shows no placeholder numbers.
4. **Given** either failure, **Then** the chips and the first closed section (which need no figures) are still shown.

---

### Edge Cases

- The TV projection's average miss is worse than the know-nothing guess's: the marks sit in their true order along the line and their labels still do not overlap.
- Two marks have values very close together (the goal and the TV projection are always one margin apart, which is only a few runs): labels and values stay separate at every width.
- The goal's margin is large compared with the TV projection's average miss, so the goal's value is zero or below: the line extends to include it, it is drawn at its true position, and the text equivalent states the value as it is.
- The figures are very large or very small: the scale follows the data and the marks stay in view.
- A very narrow screen (360 pixels) with long names: names wrap rather than being cut off.
- Reduced motion: nothing in the section is animated at any time.
- Opening or closing a section never changes the figures shown or the meter; the closed default applies only on a fresh load.
- Text size increased by the visitor: the section reflows without overlap or clipping.

## Requirements *(mandatory)*

### Functional Requirements

**The lead and the meter**

- **FR-001**: Below the page title there is one lead line: "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by N runs less on average", where N is the goal's margin. The whole sentence is built on the server from the same margin as the goal's wording and the page shows it as sent; it is not typed into the page.
- **FR-002**: The miss meter is a horizontal number line of average miss in runs, with better (lower) on the left, and three marks: the know-nothing guess, the TV projection and the goal. Each mark shows its name and its value, with the value the largest text on it.
- **FR-003**: The know-nothing guess and TV projection values are the average misses the server sends for the training years. The goal's value is the TV projection's average miss minus the goal's margin, to one decimal place, worked out from the displayed one-decimal figures, in the same way as the server's goal.
- **FR-004**: Each mark is placed on the line in proportion to its value. The stretch of the line from its left end to the goal is shaded (in the page's "win" colours) to show where beating the goal lies.
- **FR-005**: The scale of the line is worked out from the three values, with room either side, so that every mark and its text is fully visible whatever the data, and it is the same scale for all three marks.
- **FR-006**: The meter has a caption giving the training years and the number of innings, and a footer stating the goal and that the latest calendar year, which nothing was trained or chosen on, is where it is judged. The footer uses the goal's wording from the server rather than its own.
- **FR-007**: The marks are told apart by their names, values and shapes (a dot for each reference, a vertical line for the goal), never by colour alone.

**The chips and the two sections**

- **FR-008**: Below the meter is a row of five chips, each a bold term with a few words: Agent (a LangGraph graph of steps), Language model (picks features), Code (makes every number), Linear regression (runs per unit), Rival (forward selection). The language-model chip is marked in the page's accent colour. The chips wrap on narrow screens.
- **FR-009**: Below the chips are two sections, both closed on a fresh load: "How this works, in full" and "Full figures for the two simple guesses". They open and close with the keyboard and the mouse or touch, and nothing animates.
- **FR-010**: "How this works, in full" holds the two existing introduction paragraphs, word for word as they are today.
- **FR-011**: "Full figures for the two simple guesses" holds the existing headline sentence, the existing table (the same columns and figures) and the existing sentences about the gap and the finding, all unchanged and all still coming from the server.

**Accessibility, themes and small screens**

- **FR-012**: The meter has a text equivalent stating all three values and what they mean, built from the same figures the meter draws.
- **FR-013**: The region that fills in after the figures arrive keeps announcing politely to assistive technology.
- **FR-014**: Every colour in the section is one of the page's own theme colours, so dark mode works without separate rules, and text and graphics meet readable contrast in both themes.
- **FR-015**: At widths down to 360 pixels the page does not scroll sideways, every mark's name and value is fully inside the meter's card, and no name or value overlaps another.
- **FR-016**: Below 760 pixels the values on the marks are smaller and the "better" and "worse" end labels are not shown.

**Data, errors and everything else**

- **FR-017**: Every number and every sentence about the figures comes from the server's reference figures (the goal, the figures, the training years, the sentences); none is typed into the page. The only wording typed in the page is the chips, the two section headings and the "better" and "worse" end labels, and none of it contains a number. The lead line and the mark names come from the server.
- **FR-018**: If the figures request fails, the lead line, the meter and the goal are hidden and the existing "could not be loaded" message is shown; if the server answers without figures, the meter is not drawn, the message is shown, and the section of full figures is hidden, but the lead line and a plain goal line (the goal's wording, as feature 006 shows it) remain, since they need no figures. The chips and the first section remain in both cases.
- **FR-019**: The existing test identifiers for the goal, the reference region, the headline sentence, the table, its rows, the note under it and the error message keep working, so the existing checks on them still find them; the goal's identifier is on the meter's footer.
- **FR-020**: Existing tests that assume the old two-paragraph layout (for example that the table is visible without opening anything) are updated to the new layout, and new tests cover the meter: each mark's value, the goal's value, and that every position lies within the scale.
- **FR-021**: Nothing else on the page changes: no other section, no scoring logic, and not the wording of the goal on the server.

### Key Entities

- **Reference figures**: the response the server already provides for the introduction: the goal (its margin and wording), the two references' accuracy figures on the training years, the training years and innings count, and the sentences about them.
- **Mark**: one of the three things on the meter: a name, a value, a position on the scale and a shape.
- **Scale**: the range of the number line, derived from the three values so that all marks fit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can say, after a few seconds and without opening anything, what the agent has to beat and by roughly how much (judged by a person, as in earlier reader reviews).
- **SC-002**: The running text visible in the section with both details closed (leaving out the title and eyebrow) is at most 120 words, fewer than half the roughly 260 it has today, counted automatically. What counts: the words of the rendered, visible text of the lead line, the meter (labels, values, caption and footer), the chips and the two section headings, split on whitespace; the closed sections' contents, the eyebrow and the title do not count. The server's footer wording is part of the count, so a longer goal wording could break it.
- **SC-003**: Each mark's value on the meter equals the server's figure, the goal's value equals the TV projection's average miss minus the margin to one decimal place, and each mark's position lies within the scale, checked automatically.
- **SC-004**: At 360, 390, 768 and 1280 pixels wide, every mark's name and value is fully inside its card and none overlaps another, checked automatically by measuring their boxes.
- **SC-005**: The text equivalent states all three values and matches what is drawn, checked automatically.
- **SC-006**: Both sections are closed on a fresh load, and opening them shows the original paragraphs word for word and the original table and sentences, checked automatically against the old text.
- **SC-007**: The Play control is still fully visible in a 1280 by 800 window, and no lower than it is today (about 750 pixels from the top).
- **SC-008**: With the figures request failing, no number is shown in the section and the existing message is, checked automatically.
- **SC-009**: In light and dark mode, the section's text meets 4.5 to 1 contrast, and its marks, line and the goal zone's border meet 3 to 1, checked automatically.
- **SC-010**: All existing tests still pass, with only those that assumed the old layout updated.

## Assumptions

- **The design wins on layout, and the earlier decision wins on wording.** Feature 006 requires the goal to be worded from one source. The design's footer reads "3 runs better than TV, on the latest calendar year, which nothing was trained or chosen on." That is typed text with a number in it, so the footer instead reuses the server's goal wording (as the brief allows), keeping the "The goal:" label. The lead line is a deliberate plain-language restatement of the same goal using the same margin from the server; it is the one place the goal is paraphrased.
- **The headline sentence moves into the second section.** The design lists the table and the note for the second section but does not say where the existing headline sentence ("Here is how well two simple guesses did against the real final totals in past seasons … This is the bar the agent has to clear.") goes. It stays at the top of that section, so nothing the page says today is lost and its test identifier still has an element.
- **The test identifiers**: the goal's identifier moves onto the meter's footer (as the design says). The introduction's lead line gets a new identifier. The reference region's identifier stays on the region that the script fills.
- **Typed wording** is limited to the chips, the two section headings and the "better" and "worse" end labels; all numbers, the lead line and all sentences about the figures come from the server. The "10" in "At 10 overs" comes with the lead line from the server, built from the app's fixed premise.
- **The "better" and "worse" end labels** are dropped on every screen narrower than 760 pixels, not only where they would collide, so the rule is simple and testable.
- **Label collisions** at narrow widths are avoided by wrapping names onto two lines or staggering them, whichever keeps every name and value inside the card; the exact method is a planning decision.
- **The scale** follows the design's suggestion (from a little below the goal to a little above the know-nothing guess, in whole runs), extended as needed so the labels of the outermost marks stay inside the card.
- **Both sections start closed on every fresh load** and are not remembered between visits.
- **The design file** (`goal-section-1a.html`) stays in the specs folder as a reference and is not part of the shipped page.
- **Words visible** for SC-002 counts the lead line, the meter's labels, caption and footer, the chips, and the two section headings; the title and eyebrow are left out because they do not change.

## Out of Scope

- Any other section of the page, including the graph, the model picker and the results.
- The scoring logic, the figures, and the goal's value and wording on the server.
- Changing what the two sections say, beyond where they sit.
- Adding any new figure, measure or reference to the meter.
