# Tasks: Machine Learning Stages on Every Step

**Input**: Design documents in `specs/005-ml-stages/` (plan.md, spec.md, research.md, data-model.md, contracts/structure.md, quickstart.md)
**Tests**: Included, written before the code they cover. Every test uses the fake model; **no test may reach the network**.
**Paths**: Relative to `apps/linear_regression/` unless they start with `specs/`.
**No new dependencies.** Every command runs from `apps/linear_regression/` (web commands from `web/`).

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story label (US1 to US6), used only in story phases

**Story map** (spec.md): US1 see each step's stage at a glance in the graph (P1); US2 a legend that explains the stages and lets me focus on one (P1); US3 the stage appears in the detail panel and the timeline (P1); US4 work done before the agent runs is visible too (P2); US5 understand the inner and outer loop (P2); US6 reuse for the other apps (P2).

**Build order note**: the shared stage set, the node assignments, the colour tokens and the visualiser's stage types come first (Phase 2) because every story reads them. US1 then gives badges and bands, US2 the legend and the notes plumbing, US3 the panel and timeline. US4, US5 and US6 follow. US6 is also the proof that nothing in the visualiser is specific to this app, so its test is run once more at the end.

## Phase 1: Setup

- [X] T001 Baseline before any edit: `git status` (confirm what is uncommitted: the 004 tick and note, and this feature's `specs/005-ml-stages/`), then run `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test`, and record the result (expected: 401 pytest, 83 Vitest, 89 Playwright, all passing). Kill any stray servers on ports 8000 and 5173 first

## Phase 2: Foundational (blocks every story)

- [X] T002 [P] Write failing tests in `tests/test_stages.py` for `backend/linreg/stages.py`: the set has exactly the eight stages with the ids, names and questions in `research.md` Decision 1 and the spec's Context table, in that order; `number` equals position and ids and numbers are unique; every stage has a non-empty one-sentence description; `FIT_STAGE` is `"fit"` and `CHOOSE_STAGE` is `"choose"` and both are in the set; `stage_set()` is plain JSON-ready data; `check_stages(app, mapping)` passes on a small compiled toy graph with a full mapping, ignores `__start__` and `__end__`, and raises `StageError` naming each problem for a node with no stage, a stage id not in the set, and a mapping key that is not a node
- [X] T003 Implement `backend/linreg/stages.py`: a frozen `Stage` dataclass, the tuple of eight stages (wording from research.md Decision 1), `FIT_STAGE`, `CHOOSE_STAGE`, `stage_set()`, `StageError` and `check_stages(app, mapping, stages=STAGES)`. No cricket or regression words, no import of any app module; make T002 pass
- [X] T004 [P] Write failing tests in `tests/test_structure_stages.py`: `graph_api.graph_structure` and `create_router` accept an optional `structure_extras` function and merge its result into the response without knowing its content (use a toy graph and a toy extras function); without it the response is exactly as before; with `node_meta` carrying `stage` each node has it; on the real app `/api/structure` has the eight stages in order, a `stage` on every node except start and end, `loop == {"fit": "fit", "choose": "choose"}`, and the assignments in research.md Decision 3 (`baseline` frame, `load_data` prepare, `explore` understand, `split` split, `fit_model` fit, `propose_features`/`check_proposal`/`evaluate`/`forward_selection` choose, `final_test` assess, `explain_in_cricket_terms` interpret); `check_stages` passes on the real compiled graph and its `NODE_STAGES`; a failure case removes one node's stage and the check fails (FR-003, SC-002, SC-006)
- [X] T005 Implement the backend plumbing: `NODE_STAGES` beside `NODE_ACTORS` in `backend/linreg/graph.py`; `structure_extras` in `backend/linreg/graph_api.py` (called lazily, result merged, cached for the life of the process after the first success, a failed attempt not cached; the module stays generic); in `api/index.py` pass `node_meta={n: {"actor": a, "stage": NODE_STAGES[n]} ...}` and a `structure_extras` returning `{"stages": stage_set(), "loop": {...}}` for now (notes and items arrive in later stories); make T004 pass
- [X] T006 Update `specs/001-linear-regression-agent/contracts/structure.schema.json` to allow the optional `nodes[].stage` and the optional top-level `stages`, `loop`, `notes` and `items` described in `specs/005-ml-stages/contracts/structure.md` (keep `additionalProperties: false`, add the new properties); if any existing test validates the structure against this schema, extend it to cover the new fields and run it
- [X] T007 [P] Write failing Vitest tests in `web/tests/unit/stages.test.ts` for the pure helpers in `web/src/graph-replay/stages.ts`: the types for `stages`, `loop`, `notes`, `items`; `resolveStage(node, stages)` returns assigned (stage, number) for a known id and unassigned for a missing or unknown id, and nothing for start and end nodes; a stage number above 8 resolves to the neutral colour token name; `stageNumberOf` follows the order of `stages`
- [X] T008 Implement the types and `resolveStage` in `web/src/graph-replay/stages.ts` (no stage name, no cricket word; pure); make T007 pass
- [X] T009 [P] Write failing Vitest tests in `web/tests/unit/stage-colours.test.ts` that read the eight stage tokens (light and dark) from `web/src/graph-replay/styles.ts` and check, with a small contrast helper inside the test, the rules in research.md Decision 5: the eight colours differ in each theme; number text at least 4.5:1 on the badge fill; fill at least 3:1 against the page and panel colours; the values equal the 16 expected hex values written out in the test itself (copied from research.md, with a comment pointing at it; the test never reads the spec files) so a change to a colour has to be made in both places on purpose. Also check the neutral token exists (SC-003)
- [X] T010 Add `--gr-stage-1` to `--gr-stage-8`, `--gr-stage-text` and `--gr-stage-none` to the token blocks in `web/src/graph-replay/styles.ts` (light, dark by system preference, and the `data-theme` overrides), with the values from research.md Decision 5; make T009 pass
- [X] T011 Update `web/src/graph-replay/layout.ts`: optional `stage` on `StructureNode` and `LaidNode`, the optional top-level fields on `Structure`, pass `stage` through `layoutGraph`, raise `ranksep` from 46 to 58; adjust `web/tests/unit/layout.test.ts` where needed (it checks shape, so expect no changes beyond new cases for `stage` passing through) and run all Vitest
- [X] T012 [P] Update `tests/test_boundaries.py`: `stages` joins the shared modules (it imports no app-specific module); `stage_info` joins the app-specific ones; a new test fails if any of the eight stage names, or any stage question, appears in any `*.ts` file in `web/src/graph-replay/`, comments included (the README is exempt) (the visualiser holds no stage text)

## Phase 3: User Story 1 - See each step's stage at a glance in the graph (P1)

**Goal**: every node shows a numbered, coloured badge, and neighbouring nodes of a stage sit in a labelled band, without hiding the run states or the language-model marking.
**Independent test**: load the graph with no run: every node has a badge and the bands are right; play a run: active, visited, counts and the LLM tag are still readable.

- [X] T013 [P] [US1] Write failing Vitest tests for `computeBands` in `web/tests/unit/layout.test.ts` (or `web/tests/unit/bands.test.ts`): a run of neighbours in one stage is one band; a stage split by another stage's node gives two bands (Choose the setup around Fit the model, using this app's real structure); a group whose box would enclose a foreign node (a node of another stage, or an unassigned node) is split until it does not; an unassigned node is not part of any run and is an obstacle; `__start__` and `__end__` are neither in a run nor obstacles, so a band may enclose them (a layout with `__start__` between two same-stage nodes still gives one band); a band's box contains all its nodes and none of the others; every staged node is in exactly one band
- [X] T014 [US1] Implement `computeBands(nodes, stageOf)` in `web/src/graph-replay/layout.ts` per research.md Decision 6 (order the staged nodes by position along the main direction, group neighbours, pad, split on enclosing a node of another stage or an unassigned node; `__start__` and `__end__` are exempt, per research.md Decision 6) and return `bands` in the layout; make T013 pass
- [X] T015 [P] [US1] Write failing Playwright tests in `web/tests/e2e/stages.spec.ts` (first part, against the real app with the fake model): every graph node shows a stage badge with a number, and the badges' numbers match the assignments in research.md Decision 3; the eight badge numbers present are all different; bands exist, each labelled with a stage number and name, and Choose the setup has two bands with Fit the model between them; a band never contains another stage's node; the busiest node (after a run with the default fake model, "Fast" (`fake/steady`), which visits `fit_model` three times) shows its badge, its visit count and the LLM tag without overlapping (compare bounding boxes); the run states (`active`, `visited`, `data-visits`) and the LLM tag are unchanged on nodes that show a badge; light and dark theme both show badges
- [X] T016 [US1] Implement badges and bands: new `web/src/graph-replay/bands.ts` (draws the bands as the first, bottom layer of the SVG with the stage colour for outline and tint and a label with the number and name in the page text colour, and `data-testid="stage-band"`, `data-stage` and `data-nodes` (the node ids it holds) on each band; all text from the server is set with `textContent`); in `web/src/graph-replay/graph-replay.ts` draw a badge (circle with the number, `data-testid="stage-badge"`, `data-stage` on the node group) at each node's bottom-left corner, a neutral badge for an unassigned node; styles in `web/src/graph-replay/styles.ts`; the node's fill and border are not touched; make T015 pass
- [X] T017 [US1] Run the existing Playwright specs that touch the graph (`structure.spec.ts`, `play.spec.ts`, `panels.spec.ts`, `navigate.spec.ts`, `reuse.spec.ts`) and Vitest, and fix anything the badges, bands or the `ranksep` change disturbed, without weakening a test

## Phase 4: User Story 2 - A legend that explains the stages and lets me focus on one (P1)

**Goal**: a legend of the eight stages beside the graph; selecting a stage highlights its nodes and dims the rest; works by mouse, touch and keyboard; never interrupts a run; the app-supplied notes (feature selection only) appear with it.
**Independent test**: select each stage by mouse, tap and keyboard, mid-run and after Reset, and check the active node stays undimmed and the run continues.

- [X] T018 [P] [US2] Write failing tests in `tests/test_stage_info.py` (first part) for `backend/linreg/stage_info.py`: `structure_extras()` returns `notes.stages.choose` with the plain statement that Choose the setup means feature selection only here, that plain linear regression has no hyperparameters and that tuning appears in later apps; any stage with no node in `NODE_STAGES` has a reason in `notes.stages` (vacuous today, so test it with a mapping that leaves one stage empty); the notes are plain text with no markup
- [X] T019 [US2] Create `backend/linreg/stage_info.py` with `structure_extras()` returning `{"stages": stage_set(), "loop": {...}, "notes": {"stages": {...}}}` (the choose note and the reasons for empty stages from a small dictionary), and use it from `api/index.py` in place of the stub from T005; make T018 and T004 pass
- [X] T020 [P] [US2] Write failing Playwright tests in `web/tests/e2e/stages.spec.ts` (second part): the legend lists the eight stages in order with badge, name and question; a small structure served inline with `serveStructure` in which one stage has no node shows that stage as "Not a step in this agent" with its note as the reason (the extended fixture repeats this in T035); the choose entry shows the feature-selection-only note; selecting a stage by click, by touch tap and by keyboard (Tab to the button, Enter or Space) highlights that stage's nodes and bands and dims the other stages' nodes and bands (edges are left as they are); selecting it again, and selecting "All", clears it; the polite live region announces the selection and the clearing; keyboard focus is visible; selecting a stage mid-run does not interrupt the run and the active node is never dimmed; the selection survives Pause, Step, Back, Reset and a new run; at phone width the legend is a wrapping row of numbered chips with the selected chip's name and question shown, and the page has no horizontal scroll
- [X] T021 [US2] Implement the legend: new `web/src/graph-replay/legend.ts` (buttons with `aria-pressed`, an "All" button, a visually hidden `role="status"` live region, a detail line used on narrow screens, the stage note under its entry, and a "Not a step in this agent" mark with the stage's note for a stage with no node; every stage name, question, note and reason set with `textContent`) built from the structure's `stages` and `notes`; one `selectedStage` field in `web/src/graph-replay/graph-replay.ts`, separate from the playback buffer; a `data-filter` attribute on the graph and CSS to dim other stages' nodes and bands except the active node; legend placement as the first panel in the right column and chips below the existing 760 px breakpoint; test ids `legend`, `legend-stage`, `legend-all`, `legend-detail`, `legend-live`, `legend-note`; make T020 pass
- [X] T022 [US2] Re-run the Playwright specs that use the keyboard and the toolbar (`navigate.spec.ts`, `play.spec.ts`, `llm-run.spec.ts`) to confirm the legend's buttons do not disturb the global arrow keys or Play and Reset

## Phase 5: User Story 3 - The stage appears wherever a step appears (P1)

**Goal**: the detail panel and the timeline show each step's stage, and the stage agrees everywhere.
**Independent test**: play a run and compare the graph, the panel and the timeline for every step.

- [X] T023 [P] [US3] Write failing Playwright tests in `web/tests/e2e/stages.spec.ts` (third part): for every step of one full run (step through with Next), the active node's badge number, the Event panel's stage line (`event-stage`: badge, name, question, and the stage note when present) and the current timeline entry's badge (`timeline-stage`) all show the same stage; every timeline entry has a badge; the timeline's existing test ids, the count and `aria-current` behaviour are unchanged; the run visibly moves between stages 5 and 6 in the timeline; the leaderboard and the results are unchanged (the existing specs still pass)
- [X] T024 [US3] Implement the panel line and the timeline badges in `web/src/graph-replay/graph-replay.ts` (`updatePanels`, `updateTimeline`): the stage line beside the step name and actor pill, a badge inside each timeline button (with the stage in its `aria-label`), reading the stage from the same resolved assignment as the graph, with the stage name, question and note set with `textContent`; styles in `web/src/graph-replay/styles.ts`; make T023 pass

## Phase 6: User Story 4 - Work done before the agent runs is visible too (P2)

**Goal**: a display-only "done beforehand" item ahead of `load_data` in Prepare the data, with a summary and a link to the Data tab; never a run step.
**Independent test**: it is drawn differently, never becomes active, is absent from the timeline, and opens a correct summary by mouse and keyboard.

- [X] T025 [P] [US4] Write failing tests in `tests/test_stage_info.py` (second part): `/api/structure` has one item with `stage` `prepare` and `before` `load_data`; its `summary.rows` equal the manifest's figures (exclusion counts by reason, totalled over competitions like the Data tab, and the column counts: measured features, derived features, and the two competition columns, from the catalogue and `competition_dummies`); its link is `#data`; `exclusion_rows(manifest)` gives the same rows the Data tab shows in its "Excluded, and why" section; with the manifest unreadable the item is still sent with the text "Details could not be loaded." and the link
- [X] T026 [US4] Extract the exclusion aggregation from `data_table._summary` into a public `exclusion_rows(manifest)` in `backend/linreg/data_table.py` (the Data tab output must not change: run `tests/test_data_api.py` and the Data tab specs), add the item builder to `backend/linreg/stage_info.py` using it and the feature catalogue, handle the unreadable manifest, and add `items` to the response; make T025 pass
- [X] T027 [P] [US4] Write failing Vitest tests in `web/tests/unit/layout.test.ts`: an item becomes a node (id `item:<id>`, kind item) joined to its `before` node by an edge marked as an item connector; it takes part in the bands of its stage with the node it sits before, and it shares one band with that node even when `__start__` sits between them on the same rank; it is an obstacle for other stages' bands; it never appears in anything derived from events
- [X] T028 [P] [US4] Write failing Playwright tests in `web/tests/e2e/stages.spec.ts` (fourth part): the item is drawn dashed and muted with a "done beforehand" tag and a stage 2 badge, ahead of `load_data`, joined by a dotted line, and one `stage-band` (stage 2) has both the item and `load_data` in its `data-nodes`; after a full run it was never active or visited, is not in the timeline, and the step count is the same as before; it can be opened by click and by keyboard (Tab, Enter) and shows the exclusion counts and the columns created, with a `#data` link that goes to the Data tab; opening it mid-run does not interrupt the run; Close closes it; it does not change the Event panel
- [X] T029 [US4] Implement the item: item nodes and connectors in `web/src/graph-replay/layout.ts`, drawing in `web/src/graph-replay/graph-replay.ts` and `web/src/graph-replay/bands.ts`, the item panel and its Close button in `web/src/graph-replay/legend.ts` (summary text and rows inserted with `textContent`, the link rendered only when its `href` starts with `#`), keyboard and touch support (the item is the only selectable node), styles; test ids `item`, `item-panel`, `item-link`; make T027 and T028 pass

## Phase 7: User Story 5 - Understand the inner and outer loop (P2)

**Goal**: a short explanation of the two loops with the real years, and an emphasised fit and choose loop with a round count that follows the replay.
**Independent test**: run the agent: the edges between Fit the model and the Choose the setup steps emphasise from round 2 with a rising count; Back lowers it; Reset clears it; the note names the real years.

- [X] T030 [P] [US5] Write failing Vitest tests in `web/tests/unit/stages.test.ts` for `roundAt(events, cursor, stageOf, fitStage)` and `loopEdges(structure)`: round counts `fit`-stage events up to the cursor; it is 0 before any, 1 after the first, rises on each return; moving the cursor back lowers it; a cursor of -1 gives 0; `loopEdges` returns the edges joining a `fit` node and a `choose` node in either direction and not an edge between two `choose` nodes; both work for a second graph with different stage ids
- [X] T031 [P] [US5] Write failing tests in `tests/test_stage_info.py` (third part): `notes.general` contains the training years (first and last), the validation year and the test year equal to `split_three_ways` on the loaded data, says that parameters are learned from the training years, the setup is chosen using the validation year and the test year is used once at the end, and that a new setup (stage 5) means the model is fitted again (stage 6); with the data unreadable the note is sent without the years sentence and with no invented years
- [X] T032 [P] [US5] Write failing Playwright tests in `web/tests/e2e/stages.spec.ts` (fifth part, using the default fake model "Fast" (`fake/steady`), which visits `fit_model` three times): the general note appears near the legend and shows the real years from `/api/data`'s summary; before a second visit to Fit the model the edges between the fit and choose nodes look like any other edge; after it they are emphasised (heavier, with a `loop-round` pill showing the count); the count rises on each return; Back lowers it; Reset clears it; the emphasis does not rely on animation (it is present under reduced motion)
- [X] T033 [US5] Implement the loop: `roundAt` and `loopEdges` in `web/src/graph-replay/stages.ts`; the emphasis class and the "round N" pill in `web/src/graph-replay/graph-replay.ts` (`updateGraph`, recomputed from the buffer position on every update) and styles; the general note with the years from the three-way split (cached once per process) in `backend/linreg/stage_info.py`; the note under the legend in `legend.ts`; make T030, T031 and T032 pass

## Phase 8: User Story 6 - Reuse for the other apps (P2)

**Goal**: a second, unrelated graph gets the legend, highlighting, bands, loop emphasis, item and timeline cues with no change to the visualiser; an unassigned node is neutral and flagged.
**Independent test**: render the extended second fixture and the same fixture with one stage removed.

- [X] T034 [US6] Extend `web/tests/fixtures/other-structure.json` with its own stage set (a different, smaller set with different names and ids), a `stage` on each node, a `loop`, a general note and a stage note that contains `<b>` and `<script>` text, one stage with no node and a reason, and one item with a summary and a `#` link plus one with an `http` link (keep the existing nodes and edges so the existing reuse tests still pass)
- [X] T035 [P] [US6] Write failing Playwright tests in `web/tests/e2e/reuse.spec.ts` (extend it): the second graph shows its legend with its own names, badges, bands, highlight and dim, loop emphasis (with a replay built from the fixture or a served stream), the item and its summary; the note and the markup-like text render as plain text; the stage with no node shows "Not a step in this agent" and its reason; the `http` link is shown as text, not a link; with one node's stage removed (the fixture served with that change in the test) that node has a neutral badge and the legend flags it as unassigned
- [X] T036 [US6] Make T035 pass by removing any assumption the visualiser turns out to hold about this app (a stage name, a stage count of eight, a node id), in `web/src/graph-replay/` only; re-run `tests/test_boundaries.py` (T012) to confirm no stage text is in the visualiser

## Phase 9: Polish & Cross-Cutting

- [X] T037 [P] Update docs: `web/src/graph-replay/README.md` (the `stages`, `loop`, `notes` and `items` fields, the badge, bands, legend, loop emphasis, item panel, what a host app must supply, the `#`-only link rule, and that selection is a view preference), `apps/linear_regression/README.md` (the stage set lives in `backend/linreg/stages.py`; how to assign a node a stage; `check_stages` for other apps), and note in `specs/005-ml-stages/contracts/structure.md` anything that changed while building
- [X] T038 Run everything: `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test`, `cd web && npm run build`; confirm every existing test still passes (SC-007), no test reached the network, and take screenshots of the page after a run in light, dark and phone width for the owner review
- [ ] T039 Owner visual review (no code): look at the page in both themes and in greyscale; confirm the closest colour pairs (numbers 4 and 6 in light, 3 and 7 in dark, research.md Decision 5) are acceptable, the badge never crowds a node, and decide whether the legend (right column) and the item panel are where you want them; any change becomes a small follow-up task
- [ ] T040 Reader review (SC-001, needs a person): someone with no machine learning background watches one run, then names the stage of any three steps shown to them and says which stage fits parameters and which chooses the setup; record the outcome in `specs/005-ml-stages/checklists/requirements.md` notes

## Dependencies & Execution Order

- Phase 1, then Phase 2 (blocks everything). Within Phase 2: T002 before T003; T004 before T005; T007 before T008; T009 before T010; T011 and T012 can run beside the others once T003 and T008 exist.
- US1 needs Phase 2. US2 needs US1 (badges and bands to dim) and T005. US3 needs US1. US4 needs US1 (bands and layout) and US2 (the item panel lives with the legend module). US5 needs US2 (the note under the legend) and US3 is not required. US6 needs US1 to US5 (it proves them generic).
- The only ordering constraints inside a story are the usual ones: its tests before its implementation.
- Polish last.

Order of delivery: Phase 1, Phase 2, US1, US2, US3, then US4, US5, US6, then Polish.

## Parallel examples

- Phase 2: T002, T004, T007 and T009 together (different files); T012 beside them.
- US1: T013 and T015 together.
- US2: T018 and T020 together.
- US4: T025, T027 and T028 together.
- US5: T030, T031 and T032 together.

## Implementation strategy

1. **Safe first step**: T001 records what passes today.
2. **One source first**: Phase 2 gives the stage set, the node assignments, the generic check, the schema, the colour tokens (with their contrast test) and the visualiser's types, with nothing visible yet.
3. **Visible core**: US1 to US3 give badges, bands, the legend with highlight, the panel line and the timeline badges. This is the minimum worth looking at.
4. **Teaching extras**: US4 (done beforehand) and US5 (the loop) add the two ideas newcomers find hardest.
5. **Prove reuse**: US6 runs the same visualiser on an unrelated graph.
6. **Finish**: docs, the full run, the owner's visual review and the reader review (SC-001).
7. Throughout: no test reaches the network; no node function, step event, leaderboard or result changes.

## Task counts

| Phase | Tasks |
|---|---|
| Setup | 1 (T001) |
| Foundational | 11 (T002 to T012) |
| US1 Badges and bands | 5 (T013 to T017) |
| US2 Legend and highlight | 5 (T018 to T022) |
| US3 Panel and timeline | 2 (T023 to T024) |
| US4 Done beforehand | 5 (T025 to T029) |
| US5 The loop | 4 (T030 to T033) |
| US6 Reuse | 3 (T034 to T036) |
| Polish | 4 (T037 to T040) |
| **Total** | **40** |

## Notes from building

- **Timeline cue**: the stage cue on each timeline entry is drawn by CSS from `data-stage-number` (plus `data-stage` and the stage in the `aria-label`), not an element with its own test id, so the button text stays "3. explore" and existing tests keep passing (T023, T024).
- **Legend flag for unassigned steps** was missing after US2 and was added in T036 (`legend-unassigned`), where the reuse tests found it.
- **Existing tests touched** (selectors only, no weaker assertions): `tryit.spec.ts` looks up the Predict button with `exact: true` (the legend's first question contains "predicting"); `structure.spec.ts` counts the agent's 17 edges as `.edge:not(.item-edge)` and the item's connector separately.
- **Test load**: `playwright.config.ts` caps workers at 8 and the two six-run tests in `llm-run.spec.ts` have a 180 s timeout, because all tests share one API process.
- **Fixture**: `web/tests/fixtures/linreg-structure.json` is this app's real structure; `tests/test_structure_stages.py` fails if it drifts.
- **Open for the owner**: T039 (visual review) and T040 (reader review, SC-001).
- **Stage order changed after the build (owner's decision, 2026-10-06)**: the stage list is now in the order a run first reaches each stage, numbered 1 to 8 (prepare, split, understand, frame, choose, fit, assess, interpret), so the badges along a run read 1, 2, 3, 4, 5, 6, 5, 6, ... 7, 8. Only `stages.py` and the tests that name numbers changed; the colours are keyed by number and did not move.
