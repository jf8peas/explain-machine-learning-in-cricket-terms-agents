# Tasks: Stage Rows in the Agent Graph

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/dom.md](contracts/dom.md), [design/](design/)
**Prerequisites**: none beyond the repo. No `.specify` scripts or template exist, so this follows the standard tasks layout by hand.
**Tests**: requested by the planning brief (unit and e2e), so test tasks are included.

All paths are under `apps/linear_regression/web/` unless stated. `G` = `src/graph-replay/`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 rows, US2 short straight edges, US3 items in Start row, US4 visit count, US5 everything else keeps working

---

## Phase 1: Setup

- [x] T001 Run the current unit tests and `tests/e2e/stages.spec.ts` once to record a green baseline; note which e2e cases mention bands, `.count-bg` or `data-visits` (lines about 55-97, 189-200, 403-405, 612-620, 660-671); grep `tests/unit/layout.test.ts` and `tests/unit/bands.test.ts` for `bands`, `computeBands` and `.nodes` of a band, and note every case that must change

---

## Phase 2: Foundational (blocks all stories)

- [x] T002 Add the `Row` type and change `Layout` to `{ nodes, edges, rows, width, height }` (remove `Band`, `bands`, `BAND_PAD`, `BAND_LABEL`, `LABEL_*`) and add `row: number` to `LaidNode` in `G/layout.ts`
- [x] T003 Implement the pure `computeRows` in `G/layout.ts`: Start, stages in `stages` order, Finish; full width, stacked with no gaps, `h` at least base height (60; Start 64), label position centred on the row's node line; an empty stage still gets a row; remove `computeBands`
- [x] T004 Add unit tests for `computeRows` (order, full width, no gaps, label position, empty stage, taller row when extra top height is requested) replacing the `computeBands` cases in `tests/unit/bands.test.ts`; also rewrite that file's "bands for this app's real graph" cases (they assert two Choose bands and band membership) as row cases once T005 lands, and fix any `bands` use in `tests/unit/layout.test.ts` found in T001

**Checkpoint**: `computeRows` passes its tests; `layoutGraph` and the drawing code do not compile yet.

---

## Phase 3: User Story 1 - Read the run stage by stage (P1) 🎯 MVP

**Goal**: ten borderless tinted rows with a label column, every node in its stage's row.
**Independent test**: render the real structure; 10 rows in order, nodes inside their rows, no row stroke.

- [x] T005 [US1] In `layoutGraph` (`G/layout.ts`) assign each node a row: Start/Finish for start/end nodes, its stage's row when the stage is in `stages`, otherwise the row of its nearest staged predecessor (else Start); set y from the row
- [x] T006 [US1] In `G/layout.ts` order nodes within each row by dagre x and pack them with a fixed gap; shift x so the leftmost node clears the label column (200px, widened to fit the longest stage name); set `width` and `height` from the rows
- [x] T007 [P] [US1] Add unit tests to `tests/unit/layout.test.ts`: the label column width grows to fit a very long stage name; every node's y lies inside its row; row order matches `stages`; a 3-stage structure in a different order lays out in that order; a structure without `stages` still lays out; unassigned node lands in a row and keeps no stage; no two nodes overlap
- [x] T008 [US1] Rewrite `G/bands.ts` as `drawRows`: first-layer `g.stage-row` per row with `data-testid="stage-band"`, `data-stage`, `data-stage-number` (Start/Finish: `data-row`), full-width `rect` (fill `var(--stage-colour)`, `fill-opacity .1`; Start/Finish `--gr-stage-none` at `.06`; no stroke, no radius), label group with badge (r 8), number and name; Start/Finish muted, no badge
- [x] T009 [US1] In `G/graph-replay.ts` replace `drawBands(bandsG, L.bands, stages)` with `drawRows(bandsG, L.rows, stages)` and update imports and the `.band` selector in `applyFilter` to `.stage-row`
- [x] T010 [P] [US1] In `G/styles.ts` replace the `.band` rules with `.stage-row` rules using existing tokens (rect fill/opacity, no stroke, label text `--gr-text`, Start/Finish `--gr-muted`); keep `.band-badge`, `.band-number`, `.band-name`; check dark theme
- [x] T011 [US1] Update the e2e cases in `tests/e2e/stages.spec.ts` for rows: 10 `stage-band` elements in order, label column badge/name, nodes inside their row, no stroke, rows are the first SVG layer, each label fits within the row

**Checkpoint**: the graph shows rows with nodes in them (edges may still look rough). US1 testable alone.

---

## Phase 4: User Story 2 - Short, straight edges (P1)

**Goal**: spine on one vertical line, `fit_model` under `check_proposal`, loop-backs inside rows, orthogonal routes.
**Independent test**: on the real structure the spine nodes share x, `fit_model` is under `check_proposal`, all edge segments are axis-aligned.

- [x] T012 [US2] In `G/layout.ts` add the anchoring pass: process rows top to bottom; a node with a forward predecessor in an earlier row takes that predecessor's x (with several, the one in the nearest earlier row; ties to the first in edge order, so Finish aligns under `explain_in_cricket_terms`, not `load_data`); others pack around the anchor in dagre order; Start sits at the spine x
- [x] T013 [US2] In `G/layout.ts` implement orthogonal edge routing per the plan: vertical when aligned, horizontal when adjacent in a row, arcs above the row for same-row loop-backs and skips (track by span), down-across-down for forward cross-row, one-turn for backward cross-row, right-margin route for forward edges that would cross a node; place conditional-edge labels at the midpoint of the longest segment
- [x] T014 [US2] In `G/layout.ts` give rows extra top height per arc track (22 each) and feed it to `computeRows`; reserve the right margin in `width`
- [x] T015 [P] [US2] Add unit tests to `tests/unit/layout.test.ts` on the real fixture: spine (`load_data`, `split`, `explore`, `baseline`, `propose_features`) share x; `fit_model` x equals `check_proposal` x and its row is later; `final_test` under `grid_search`; `__end__` shares x with `explain_in_cricket_terms`; every edge's consecutive points differ in only x or y; same-row loop-back edges stay within the row's rectangle; `load_data → __end__` runs right of every node; choose row taller than a single-line row
- [x] T016 [US2] Check loop pills still sit beside their edges and clear of nodes (pill placement uses `e.label ?? midpoint` in `G/graph-replay.ts`); adjust the offset only if the e2e overlap checks fail
- [x] T017 [US2] Add an e2e case in `tests/e2e/stages.spec.ts` that spine nodes share x on screen and `fit_model` sits below `check_proposal`

**Checkpoint**: layout matches `design/stage-rows-1a.html` closely.

---

## Phase 5: User Story 3 - Items in the Start row (P2)

**Goal**: display-only items left of Start, connector into Start.
**Independent test**: `prepare_data` item inside the Start row, left of the start node.

- [x] T018 [US3] In `G/layout.ts` place items in the Start row left of the start node (spine x at least label column + item width + gap), keep their stage on the node, and route the dotted connector horizontally into Start; keep the ignore-unknown-target rule
- [x] T019 [P] [US3] Update the item cases in `tests/unit/bands.test.ts` (the "done-beforehand items in the layout" block; replace the "one band with the node it sits before" and start-marker cases): item `kind`, row is Start, x less than start's x, connector ends at Start, unknown target ignored, no items changes nothing
- [x] T020 [US3] Update the item e2e (line about 403-405) in `tests/e2e/stages.spec.ts`: item lies inside the Start row's rectangle and left of the start node; the Prepare the data row holds `load_data` only; item badge unchanged

---

## Phase 6: User Story 4 - Visit count beside the tick (P2)

**Goal**: `✓N` from the first visit; no blue circle.
**Independent test**: after a run `load_data` shows `✓1` and a repeated step shows its higher count.

- [x] T021 [P] [US4] Add `visitTick(n)` to `G/stages.ts` (empty at 0, `✓N` otherwise) and unit tests in `tests/unit/stages.test.ts` for 0, 1, 6, 12
- [x] T022 [US4] (do this before T012, since widths affect placement) In `nodeSize` (`G/layout.ts`) add 18 to the width when `actor === "llm"`
- [x] T023 [US4] In `drawGraph` (`G/graph-replay.ts`) remove `.count-bg` and `.count`; draw `text.tick` at `x = w/2 - 5`, `y = -h/2 + 10` (LLM: `y = 0`), right-anchored, hidden; shift the label 9px left on LLM nodes and keep the tag position
- [x] T024 [US4] In `updateGraph` (`G/graph-replay.ts`) set tick text from `visitTick(n)`, hide at 0, and leave `data-visits` as it was (set from the second visit)
- [x] T025 [P] [US4] In `G/styles.ts` remove `.node .count` and `.count-bg` rules; style `.tick` (10px, `--gr-visited-border`, bold number via tspan with 2px spacing) for visited and active states, light and dark
- [x] T026 [US4] Update e2e in `tests/e2e/stages.spec.ts`: replace the `.count-bg` overlap case with tick/badge/LLM-tag non-overlap; replace the "visit count readable" case with: first visit shows `✓1`, a repeated step shows `✓N` equal to `data-visits`, no `.count-bg` exists, tick colour is the visited border token; a count of 10 or more stays inside its node and clear of the badge and LLM tag (use a unit-level or fixture run if the fake run never reaches 10)

---

## Phase 7: User Story 5 - Everything else keeps working (P1)

**Goal**: legend dimming on rows, playback, timeline, panels, test ids unchanged.

- [x] T027 [US5] In `G/styles.ts` set `.stage-row.dim { opacity: .3 }` and `.stage-row.stage-selected rect { fill-opacity: .2 }`; confirm `applyFilter` dims Start/Finish rows when a stage is selected
- [x] T028 [US5] Update the legend e2e (line about 189-200) in `tests/e2e/stages.spec.ts`: Choose the setup now has one row; picking it dims every other row, again or All clears
- [x] T029 [US5] Run the full e2e suite (`tests/e2e/*.spec.ts`) and the unit suite; fix any regression in playback, timeline, panels, item panel, loop pills

---

## Phase 8: Polish

- [x] T030 [P] Update `G/README.md`: Stages section (rows instead of bands, Start/Finish, label column, items in Start row, tick with count, selection dims rows) and Files table (`bands.ts` draws rows, `layout.ts` placement and routing, `stages.ts` `visitTick`)
- [x] T031 [P] Add light and dark theme checks to the e2e (row label, name and tick legible against the tinted row) in `tests/e2e/stages.spec.ts`, keeping the existing contrast cases
- [x] T032 Compare the running app against `design/stage-rows-1a.html` by eye in light and dark themes, fix spacing differences, and run the steps in `quickstart.md`
- [x] T033 Run lint and type-check for the web app and fix findings

---

## Dependencies and order

- Phase 1, then Phase 2 (T002 → T003 → T004) blocks everything.
- US1 (T005-T011) first; then T022 (LLM width), since node widths affect placement; US2 (T012-T017) builds on US1's rows; US3 (T018-T020) needs US2's anchoring (Start sits at the spine x); the rest of US4 (T021, T023-T026) is independent of US2/US3; US5 (T027-T029) last.
- Polish after all stories.

## Parallel opportunities

- T007 with T008-T010 (different files) once T005-T006 are done.
- T010 (`styles.ts`) with T008 (`bands.ts`).
- T015 and T019 (both `layout.test.ts`) must not run together; T021 (`stages.test.ts`) and T025 (`styles.ts`) can run alongside any layout task.
- T030 and T031 together.

## Implementation strategy

- **MVP**: Phases 1-3 (rows with nodes inside). Visual layout is rough until US2.
- Then US2 for the look in the design, US3 and US4 in either order, US5 to close, then polish.
- Commit after each phase with the suite green.
