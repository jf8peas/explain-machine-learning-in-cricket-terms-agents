# Feature Specification: Stage Rows in the Agent Graph

**Feature Branch**: `009-stage-row-graph` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-09
**Status**: Draft
**Input**: Redraw the agent graph as one horizontal row per stage (Start, the eight stages, Finish) instead of bordered stage bands, with colour alone separating rows, a label column on the left, shorter and straighter edges, display-only items in the Start row, and the visit count moved next to the visited tick.

## Context

The replay graph groups steps into bordered stage bands. Bands add many lines to a diagram that already has many edges, and the blue visit-count circle on each step is easily confused with the stage number badge. The design reference is `design/stage-rows-1a.html` with `design/README.md`; this spec states the behaviour, the design files give the exact look.

The graph component is generic: it draws whatever stages and steps the structure supplies and knows nothing about the cricket app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the run stage by stage (Priority: P1)

A visitor watching a replay sees the graph as a stack of full-width coloured rows, top to bottom: Start, stages 1 to 8 in the structure's order, Finish. Each row's label column shows the stage number badge and name. Every step sits in its own stage's row. There are no borders; tint alone separates rows.

**Why this priority**: This is the whole point of the redraw.

**Independent test**: Render a structure with N stages; check N+2 rows in the stated order, each step inside its stage's row, no row borders.

**Acceptance Scenarios**:

1. **Given** a structure with eight stages, **Then** the graph shows a Start row, eight stage rows in structure order, and a Finish row.
2. **Given** any step with an assigned stage, **Then** it is drawn inside that stage's row.
3. **Given** a row, **Then** it spans the full graph width, is tinted with that stage's existing colour, has no border, and shows its badge and name in a left label column. Start and Finish are neutral-tinted, with muted labels and no badge.
4. **Given** a structure with a different number or order of stages, **Then** rows follow it with no change to the component.
5. **Given** the light theme and the dark theme, **Then** rows, labels and nodes are legible in both.

---

### User Story 2 - Short, straight edges (Priority: P1)

A visitor can follow the flow without tracing long detours. The main sequence runs down one vertical line; loop-back edges stay inside a row where possible; the model-fitting step sits directly under the proposal-checking step so the choose/fit loop is compact; a row grows only when it needs room for its loop-back edges.

**Independent test**: On the current structure, check the main sequence shares one x position, the fitting step is directly below the proposal-checking step, and loop-back edges within a stage stay inside that stage's row.

**Acceptance Scenarios**:

1. **Given** the main sequence of steps, **Then** they are vertically aligned so edges between them are straight.
2. **Given** a loop whose steps share a stage, **Then** its return edge stays inside that row.
3. **Given** a row needing room for such an edge, **Then** that row is taller than a single-line row; other rows keep the standard height.
4. **Given** the layout is computed, **Then** no step overlaps another or sits outside the row of its stage.

---

### User Story 3 - Display-only items show as done before the run (Priority: P2)

Display-only items (such as the data preparation script) appear in the Start row to the left of the start node, with their dotted connector pointing into Start, so it is clear they happen before the run. They keep their stage badge and remain selectable to open the item panel.

**Acceptance Scenarios**:

1. **Given** display-only items in the structure, **Then** each is in the Start row, left of the start node, connected into Start.
2. **Given** an item, **Then** its stage badge and existing selection behaviour are unchanged.

---

### User Story 4 - Visit count beside the tick (Priority: P2)

The blue count circle is removed. A visited step shows its visit count right after the visited tick (✓1, ✓6) from the first visit; at zero visits nothing is shown. Language-model steps keep their tag, so the node is wider and the tick and count sit on the label line at the right edge.

**Acceptance Scenarios**:

1. **Given** a step visited once, **Then** it shows "✓1".
2. **Given** a step visited six times, **Then** it shows "✓6".
3. **Given** an unvisited step, **Then** no tick or count shows.
4. **Given** the count circle, **Then** it no longer exists; the visit count remains available on the step's `data-visits`.
5. **Given** a language-model step, **Then** its tag is not covered by the tick and count.

---

### User Story 5 - Everything else keeps working (Priority: P1)

Playback, the timeline, the legend, panels, node and edge styling, language-model styling, loop round pills and stage badges on nodes work as before. Selecting a stage in the legend dims the other rows (rather than bands) and the steps in them.

**Acceptance Scenarios**:

1. **Given** a stage selected in the legend, **Then** all other rows dim and the selected row stays full strength; "All" restores.
2. **Given** playback, step, back and reset, **Then** behaviour matches before the change.
3. **Given** the existing end-to-end tests, **Then** they pass, with the stage-band test id now on the row elements.

### Edge Cases

- A step with no assigned stage: it is drawn consistent with how unassigned steps are shown today (badge styled as unassigned) and must not be lost.
- A stage with no steps: its row still appears at standard height.
- Very long stage names: the label wraps or truncates within the label column without overlapping nodes.
- A structure with no display-only items: the Start row shows only the start node.
- Counts of 10 or more still fit beside the tick.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The graph MUST draw a Start row, one row per stage in structure order, and a Finish row, stacked with no gaps.
- **FR-002**: Every step MUST be placed in the row of its stage; start and finish nodes in their rows.
- **FR-003**: Rows MUST span the full graph width, be tinted with the stage's existing colour token at low opacity (Start and Finish neutral), and have no border.
- **FR-004**: Each row MUST show a label column with the stage badge and name (Start and Finish: muted label, no badge).
- **FR-005**: Placement MUST keep the main sequence on one vertical line, keep same-stage loop-back edges inside their row, and put the fitting step directly under the proposal-checking step.
- **FR-006**: A row MUST grow in height only as needed for in-row loop-back edges.
- **FR-007**: Display-only items MUST be in the Start row, left of the start node, with their connector into Start, keeping badge and behaviour.
- **FR-008**: The visit-count circle MUST be removed; the visited tick MUST show the count (✓N) from the first visit and nothing at zero; `data-visits` MUST be retained.
- **FR-009**: Stage badges on nodes, language-model styling, loop round pills, playback, timeline, legend and panels MUST be unchanged.
- **FR-010**: Legend stage selection MUST dim non-selected rows.
- **FR-011**: Existing test ids MUST be kept; the stage-band id moves to the row elements.
- **FR-012**: The component MUST derive rows solely from the structure's stages, with no application-specific knowledge.
- **FR-013**: Light and dark themes MUST both render correctly using theme tokens, not fixed colours.

### Key Entities

- **Stage row**: a full-width tinted horizontal strip for one stage (or Start/Finish), with a label column and the steps of that stage.
- **Step node**: a graph step, carrying stage badge, optional language-model tag, and visited tick with count.
- **Display-only item**: a non-step item shown in the Start row.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The graph contains no stage borders; the only lines are edges and node outlines.
- **SC-002**: All steps in the main sequence line up vertically, so edges between consecutive main-sequence steps are straight.
- **SC-003**: A visitor can read any step's visit count at a glance, with no confusion with stage badges (no circle other than the stage badge remains on a node).
- **SC-004**: Every existing end-to-end behaviour not tied to bands or the count circle passes unchanged. The cases that change are exactly those about band count and shape (now ten rows), a stage's neighbours sharing a band, the item's band, the count circle, and which nodes carry `data-visits`.
- **SC-005**: Rendering a structure with a different stage count produces the matching number of rows with no code change.
- **SC-006**: Text and rows meet legible contrast in both light and dark themes.

## Assumptions

- The look follows `design/stage-rows-1a.html` and its README; the README's measurements (label column about 200px, row height about 60px) are guidance.
- Unassigned steps keep today's treatment: a neutral "–" badge and a place in the legend's "No stage assigned" list. In the graph an unassigned step is drawn in the row of its nearest staged predecessor (Start if it has none).
- The label column widens to fit the longest stage name, so labels never overlap nodes.
- Layout and tick text are covered by unit tests; row and tick appearance is covered by e2e tests in both themes.
- Edge styles, colours and markers are unchanged.
- No data, agent or server behaviour changes; this is a front-end redraw only.
