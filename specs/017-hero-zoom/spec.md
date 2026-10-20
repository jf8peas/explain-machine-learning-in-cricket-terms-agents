# Feature Specification: Hero Chart: Context, Prediction and a Zoom on the Finish

**Feature Branch**: `017-hero-zoom` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-20
**Status**: Draft
**Input**: Redesign the chart in the hero of The Run tab so the part that matters (where each prediction lands at 20 overs) is easy to read, following the approved design in `specs/017-hero-zoom/design/`.

## Context

The Run tab opens with a hero chart (feature 013): one real T20 innings drawn as runs by over, with the TV projection, the know-nothing guess and what actually happened. The first 10 overs take half the chart but are only context. The part that matters, where each prediction lands at 20 overs, is cramped: the TV (164) and the know-nothing guess (162) sit almost on top of each other, the gaps to the actual total are hard to see, and the TV's error bar is squeezed against the labels.

The approved design lives in `specs/017-hero-zoom/design/`. `README.md` is the specification for layout, copy and data; `hero-zoom.html` is a visual reference only (a picture, not something the page ships; its figures follow one example innings). **Where the two differ, the README wins.** This spec states what the feature must deliver and how it is checked; everything the design does not mention stays as feature 013 built it.

The chart becomes one chart card with two panels side by side:

| Panel | Share of the chart's width | Shows |
|---|---|---|
| Line graph | 60% | All 20 overs, evenly spaced: the first 10 as grey context, the last 10 as the white prediction area |
| Zoom on the finish | 40% | A magnified ruler of the totals at 20 overs: where each prediction landed, the miss, the TV's usual miss, and the agent's "?" |

**Unchanged**: the other tabs, the hero's title and description wording, the "How good is the TV projection?" panel and the three steps (apart from the full-width rule for the header copy), and how every figure is obtained.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where each prediction lands (Priority: P1)

A visitor opening The Run tab can see, in the zoom, where the actual total, the TV projection and the know-nothing guess landed at 20 overs, how far the TV missed, and how that compares with the TV's usual miss, without squinting at crowded labels.

**Why this priority**: This is the point of the hero and the problem the feature fixes.

**Independent test**: Show the hero to a person and ask what the actual total was, what the TV said and how far off it was (judged by a person); check automatically that the zoom's figures equal the example's displayed values.

**Acceptance Scenarios**:

1. **Given** an example innings, **When** The Run tab opens, **Then** the chart card holds a line graph and a "Zoom on the finish" panel side by side, headed "ZOOM ON THE FINISH" and "total after 20 overs".
2. **Given** the zoom, **Then** a vertical ruler of totals at 20 overs shows the actual total (diamond), the TV projection (filled orange dot) and the know-nothing guess (open grey dot), each labelled to the right at its own height ("Actual <total>", "TV <projection>", "Know-nothing <guess>").
3. **Given** the labels, **Then** they never overlap, even when two values are close, and each stays attached to its marker.
4. **Given** the TV and the actual total, **Then** an orange bracket spans from the TV's value to the actual total with "<n> runs short" when the TV is below the actual total, "<n> runs over" when above, or "spot on" when equal, where <n> is the displayed actual total minus the displayed TV projection in whole runs.
5. **Given** the TV's average miss, **Then** a pale orange bar runs from TV minus that miss to TV plus that miss, with a key at the foot of the card reading "TV's usual miss, ±<average miss>".
6. **Given** the agent, **Then** a solid accent-coloured box with white text reads "The agent: ?" over "where will it land?", sits under the lowest label and above the key, and overlaps neither.
7. **Given** the values, **Then** the ruler runs from the nearest 10 below the lowest of (actual, TV, know-nothing, TV − average miss) to the nearest 10 above the highest of (actual, TV, know-nothing, TV + average miss), with a little padding at both ends so no marker sits on an edge, and ticks every 10 runs.

---

### User Story 2 - Read the first 10 overs as context (Priority: P1)

The line graph separates what is only context (the first 10 overs) from what everyone is trying to predict (the last 10), and shows what actually happened clearly.

**Why this priority**: It tells the visitor where to look and gives the zoom its place in the picture.

**Independent test**: Measure the spacing between overs and the panel widths automatically; judge the band and headings by eye.

**Acceptance Scenarios**:

1. **Given** the line graph, **Then** all 20 overs are evenly spaced, so over 10 is exactly halfway, with axis labels 0, 5, 10, 15 and 20 overs (the last in bold); the vertical axis is unchanged.
2. **Given** overs 0 to 10, **Then** they sit in a light grey band headed "CONTEXT" over "first 10 overs", the runs line there is grey, and its wicket circles are grey.
3. **Given** overs 10 to 20, **Then** they sit on the page's surface colour, headed "THE PREDICTION" over "where will the last 10 overs take it?".
4. **Given** the boundary, **Then** a dotted vertical line at 10 overs separates the two and the dot at 10 overs keeps its label (for example "82/2").
5. **Given** what actually happened after 10 overs, **Then** it is a solid line in the text colour (no longer faded) with the label "what actually happened" entirely in the white area above the line, and wickets after 10 overs are open circles.
6. **Given** the TV and the know-nothing guess, **Then** the TV's dashed line and the know-nothing guess's dotted line run from the 10-over dot to 20 overs, as before.
7. **Given** the finish, **Then** a solid vertical finish line at 20 overs carries the diamond (actual), the TV's dot and the know-nothing's open dot; the end labels and the TV's error bar are no longer on the line graph.
8. **Given** the zoom's range, **Then** a small rounded lens box on the finish line marks it, with two faint lines joining its top and bottom to the zoom panel's top-left and bottom-left corners.
9. **Given** desktop width, **Then** the line graph's plot area takes 60% of the chart's width and the zoom 40%.

---

### User Story 3 - Read the caption and the text equivalent (Priority: P2)

The caption and the chart's text equivalent describe the new chart in words.

**Why this priority**: Preserves the hero's accessibility and its plain-words explanation.

**Independent test**: Compare the caption and text with the server's response and the example's figures.

**Acceptance Scenarios**:

1. **Given** an example innings, **Then** the caption starts "A real innings: <match>." then the fixed sentence "The first 10 overs, in grey, are context; the white part is what everyone is trying to predict.", then "<team> went from <runs>/<wickets> to <total>. The TV's straight line said <projection> and was <n> runs <short|over>: …", keeps the existing about-its-usual-miss rule, and ends "Open circles mark wickets."
2. **Given** the chart's text equivalent, **Then** it mentions the zoom: where each prediction landed, the miss, and the TV's usual miss.
3. **Given** the words in both, **Then** every figure and the short/over/spot-on wording match the displayed values for any example innings.

---

### User Story 4 - Title and description use the full width (Priority: P2)

The hero's title and description run the full width of the container.

**Why this priority**: The title wraps awkwardly today; the visitor asked for it on one line.

**Independent test**: Measure the title and description against their container at 1280 px.

**Acceptance Scenarios**:

1. **Given** desktop width, **Then** the header, description and title have no maximum width and the title has no balanced wrapping.
2. **Given** a 1280 px window, **Then** the title fits on one line.

---

### User Story 5 - Narrow screens (Priority: P2)

On narrow screens the zoom moves under the line graph at full width.

**Why this priority**: The two-panel layout must still work on phones.

**Independent test**: Check the layout and scrolling at 360 px.

**Acceptance Scenarios**:

1. **Given** a width below the existing narrow threshold, **Then** the zoom sits under the line graph at full width, the line graph keeps all 20 overs evenly spaced, and the old key under the chart is replaced by the zoom.
2. **Given** 360 px, **Then** nothing scrolls sideways.

---

### User Story 6 - Different innings and missing data (Priority: P2)

The chart copes with any example innings and with missing data.

**Why this priority**: The example can change, and the hero must never show wrong or invented numbers.

**Independent test**: Run the layout on at least three differing example innings, including the edge cases below.

**Acceptance Scenarios**:

1. **Given** an innings where the TV and the know-nothing guess are within 2 runs, **Then** their labels stay apart and readable.
2. **Given** an innings where the TV is above the actual total, **Then** the bracket says "<n> runs over" and the labels stay apart.
3. **Given** an innings where the TV equals the actual total, **Then** the bracket says "spot on".
4. **Given** no example innings, **Then** the chart card is left out, as today; without figures nothing numeric is shown.

---

### Edge Cases

- The TV and the know-nothing guess equal or within 2 runs: markers and labels still separate; the agent box never overlaps a label or the key.
- The TV's usual-miss bar extends beyond the three plotted values: the ruler's range includes it, with padding.
- The TV equals the actual total: the bracket is replaced by "spot on" and nothing implies a miss.
- All values close together: the range still spans at least one tick interval and nothing sits on an edge.
- Very large or small totals: the range and ticks adapt; ticks stay every 10 runs.
- An innings with no wickets, or a wicket after 10 overs: wicket circles appear in the right band and colour.
- Missing example, missing figures or missing average miss: the chart card or the missing parts are left out, as today, with no invented figure.
- Long labels or large text size: labels wrap or stay inside their panel; no sideways scroll at 360 px.
- Both themes: the grey context line keeps 3:1 against its band, and all text keeps 4.5:1, including white text on the agent box.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chart card MUST show a line graph (60% of the chart's width) and a "Zoom on the finish" panel (40%) side by side at desktop width.
- **FR-002**: The line graph MUST space all 20 overs evenly, with over 10 halfway and axis labels 0, 5, 10, 15 and 20 overs (the last bold).
- **FR-003**: Overs 0 to 10 MUST sit in a light grey context band headed "CONTEXT" over "first 10 overs", with a grey runs line and grey wicket circles; overs 10 to 20 MUST sit on the surface colour headed "THE PREDICTION" over "where will the last 10 overs take it?".
- **FR-004**: What actually happened after 10 overs MUST be a solid line in the text colour with its label "what actually happened" in the white area above the line, and wickets after 10 overs MUST be open circles.
- **FR-005**: A solid finish line at 20 overs MUST carry the actual (diamond), TV (filled dot) and know-nothing (open dot) markers; the line graph MUST NOT carry end labels or the TV's error bar.
- **FR-006**: A lens box on the finish line MUST mark the zoom's range and be joined to the zoom panel's top-left and bottom-left corners by two faint lines.
- **FR-007**: The zoom MUST show a ruler of totals at 20 overs with the range, padding and ticks described in User Story 1, the three markers with the same shapes as the line graph, and labels at each marker's height that never overlap.
- **FR-008**: The zoom MUST show the TV's miss as an orange bracket with "<n> runs short", "<n> runs over" or "spot on", worked out from the displayed actual total and TV projection.
- **FR-009**: The zoom MUST show the TV's usual miss as a pale orange bar spanning exactly TV ± its average miss on the zoom's scale, with a key reading "TV's usual miss, ±<average miss>".
- **FR-010**: The zoom MUST show the agent box ("The agent: ?" over "where will it land?") in the accent colour with text that keeps 4.5:1 contrast in both themes, placed under the lowest label and above the key without overlapping either.
- **FR-011**: The caption MUST follow the design's wording (including the fixed context sentence and "went from <runs>/<wickets> to <total>") and the text equivalent MUST describe the zoom, both built from the example's figures.
- **FR-012**: The hero's header, description and title MUST run the full width of the container with no balanced wrapping on the title, so the title fits on one line at 1280 px.
- **FR-013**: Below the existing narrow threshold the zoom MUST sit under the line graph at full width, replacing the old key, and the page MUST NOT scroll sideways at 360 px.
- **FR-014**: Every number MUST come from the reference response (the example innings, the TV's average miss and the average total); nothing is typed into the page or newly calculated beyond the displayed miss and the ruler's range and ticks.
- **FR-015**: Series MUST be told apart by shape, line style and label as well as colour; both themes MUST keep 4.5:1 text contrast (3:1 for the grey context line against its band); nothing animates.
- **FR-016**: With no example innings the chart card MUST be left out; the other tabs and the rest of the hero (the TV panel and the three steps) MUST be unchanged; tests MUST never call a real language model and the OpenRouter key MUST never reach the browser; and all existing tests MUST pass, changed only where they checked the chart's old layout, labels or caption.

### Key Entities

- **Example innings**: the real innings drawn in the hero: runs by over, wicket overs, runs and wickets at 10 overs, final total.
- **Predictions**: the TV projection, the know-nothing guess (the average total) and the actual total, all at 20 overs.
- **TV's usual miss**: the TV's average miss over the reference innings.
- **Zoom range**: the span of totals the zoom shows, derived from the three predictions and the TV's usual miss.
- **Miss**: the displayed actual total minus the displayed TV projection, in whole runs, with its direction (short, over, spot on).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At desktop width the line graph's plot area takes 60% of the chart's width and the zoom 40%, measured automatically.
- **SC-002**: On the line graph the gap between overs is the same everywhere, measured automatically.
- **SC-003**: In the zoom the actual, TV and know-nothing labels never overlap, for at least three example innings, including one where the TV and the know-nothing guess are within 2 runs and one where the TV is above the actual total.
- **SC-004**: The bracket's figure and wording ("short", "over" or "spot on") match the displayed actual total and TV projection in every case checked.
- **SC-005**: The TV's usual-miss bar spans exactly the TV projection ± the average miss on the zoom's scale.
- **SC-006**: The agent box's text meets 4.5:1 contrast in both themes, and every other text in the chart meets 4.5:1 (the grey context line 3:1).
- **SC-007**: At 360 px the zoom sits under the line graph and nothing scrolls sideways.
- **SC-008**: The hero's title fits on one line at 1280 px.
- **SC-009**: Within a few seconds a visitor can say where the actual total landed, where the TV landed and how far off it was (judged by a person).
- **SC-010**: The full existing test suite passes, with tests changed only where they checked the chart's old layout, labels or caption.

## Assumptions

- The design README's copy and rules are the source of truth; where it contains figures from the example innings, the page supplies its own from the reference response.
- The reference response already carries every figure the chart needs (runs by over, wicket overs, the TV projection, the average total and the TV's average miss); only the caption and text equivalent wording the server builds change.
- The existing narrow-width threshold, the label-spreading helper and the TV and accent colour tokens are reused; a context-band token and a context-line token are added with dark-theme values.
- The ruler's range and tick positions are derived from the displayed values by rounding to the nearest 10 with padding; this is layout, not a new statistic.
- The agent box shows "?" because the agent's prediction is not known before a run.
- "The line graph takes 60% and the zoom 40% of the chart's width" is measured on the two panels, the line graph panel including its own axis labels; the gap between them is part of neither, so the shares are checked with a small tolerance (within 1 percentage point).

## Clarifications

### Session 2026-10-20

- No questions asked: the one open point (what the 60/40 split is measured on) has a reasonable default, recorded under Assumptions; everything else is covered by the design README.
