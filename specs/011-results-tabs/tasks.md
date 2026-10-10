# Tasks: Results in Tabs That Follow the Process

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)
**Prerequisites**: none beyond the repo (no `.specify` scripts or template exist; standard layout used by hand).
**Tests**: required by the brief (Vitest and Playwright), so test tasks are included.

All paths are under `apps/linear_regression/web/` unless stated. `P` = `src/page/`, `T` = `src/tab-set/`, `G` = `src/graph-replay/`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

Stories: US1 Working stays focused on watching, US2 five tabs in process order, US3 tabs are links and switching loses nothing, US4 move to results when the run finishes, US5 not-ready tabs and markers, US6 keyboard, screen reader, phone.

---

## Phase 1: Setup

- [x] T001 Run `npm run test` and `npx playwright test` once for a green baseline; check `vitest.config` for a DOM environment and note it for T006; then `grep -rn` the e2e specs in `tests/e2e/` for every test that reads results, the model line, leaderboard, grid, reasoning, comparison, explanation, `results`, `tryit` or `data-error` on the Working page, and list them (they will need to open a tab first, T030)

---

## Phase 2: Foundational (blocks every story)

- [x] T002 [P] In `G/graph-replay.ts` add `run` (a counter that goes up by one each time a new run starts) and `failed` (true when the stream ended with an error event) to the `replaychange` detail and to the `ReplayChangeDetail` type; set them in the component's own run handling (`startRun`, `onError`, `onDisconnect`) with no app knowledge
- [x] T003 [P] In `T/tab-set.ts` add `select(id, { focus })` (goes through the same hash mechanism as a click; with `focus`, moves focus to the panel's first `[tabindex="-1"]` heading only after the panel is shown, for example on the resulting `tab-show`, because a hidden panel cannot take focus)
- [x] T004 In `T/tab-set.ts` add `setMarker(id, on)`: a small dot plus visually hidden text ("new results") inside that tab's button; `show` clears the shown tab's marker
- [x] T005 In `T/tab-set.ts` add a polite live region inside the component announcing programmatic switches ("Now showing: <label>"), and CSS so the tab list scrolls sideways inside itself (`overflow-x: auto`, no wrapping), scrolling the selected tab into view; no animation anywhere
- [x] T006 [P] Create `tests/unit/tab-set.test.ts`: `select` changes the active tab and the hash; with `focus` the heading is focused; `setMarker` adds and removes the dot and hidden text; showing a tab clears its marker; the live region text after a programmatic switch (use the existing unit-test DOM setup, or add a small jsdom/happy-dom-free test over the class if the repo has none; follow how other component tests are written; T001 records whether `vitest.config` has a DOM environment, and this task uses that answer)
- [x] T007 In `P/leaderboard.ts` export the existing attempt-ordering function (the one `renderLeaderboard` uses to order and mark the leader) without changing its behaviour

**Checkpoint**: components have the generic features; nothing on the page uses them yet.

---

## Phase 3: User Story 2 - Five tabs in the order of the process (P1) 🎯 MVP

**Goal**: five panels in order, every result in exactly one of them, every existing test id kept.
**Independent test**: five tabs in the stated order; each old result appears in exactly one tab.

- [x] T008 [US2] In `index.html` restructure `<tab-set default-tab="working">` into five panels in this order: `data`, `working`, `found`, `final-test`, `try-your-own` with the labels Data, Working, What the agent found, The final test, Try your own innings; the Data panel's contents unchanged
- [x] T009 [US2] In `index.html` move the introduction section (above the tab set today) to the top of the Working panel, above the catalogue, the model picker, the variation note and `<graph-replay>`; keep its test ids
- [x] T010 [US2] In `index.html` give each panel an `h2` with `tabindex="-1"` first; give each result panel a "not ready" paragraph with its sentence (what will appear there after a run, one sentence for each of found, final-test and try-your-own, plus a link to `#working`, test id `not-ready`), its content container, and the Cricsheet attribution line; keep `results` on the What the agent found container, add `results-final` for The final test, and move the try-your-own card into its panel unchanged
- [x] T011 [US2] In `P/results.ts` split `renderResults` into `renderFound(target, state)` (model line, language-model notice, leaderboard, grid search, reasoning, then once `final` exists a link to `#final-test`) and `renderFinal(target, state)` (final comparison, accuracy table and chart, the two best-setup lines, the explanation, the "no method can be perfect" note), reusing the existing pieces unchanged; remove the data-error branch from the results and remove `renderResults`
- [x] T012 [US2] In `P/main.ts` replace the single `renderResults` calls (on `replaychange`, on first render and after the catalogue loads) with `renderFound` into `[data-testid=results]` and `renderFinal` into `[data-testid=results-final]`, both from `detail.state`
- [x] T013 [P] [US2] Create `tests/e2e/tabs.spec.ts` with: five tabs in the stated order and labels; Data first; each result of the old page (leaderboard, grid, reasoning, comparison, chart, explanation, try-your-own form) is found in exactly one tab after a full run (open each tab and check its test ids; check none appears in two)
- [x] T014 [US2] Run `npx playwright test` and `npm run test`; note which existing tests fail only because a result moved (T030 fixes them)

---

## Phase 4: User Story 1 - Working stays focused on watching (P1)

**Goal**: Working shows the intro, picker, graph and a one-line summary, and nothing else; the data error shows there.
**Independent test**: load the page with no run and read the Working tab; run with a data error and see the error on Working.

- [x] T015 [P] [US1] Create `P/summary.ts`: before any run one sentence ("results will appear here and in the result tabs"); during and after a run the leading attempt at the step on display, its average miss, who proposed it, and a link to `#found`, using the leaderboard's exported ordering function (T007); a data error replaces the line (`role="alert"`, test id `data-error` kept); all text inserted as text
- [x] T016 [US1] In `index.html` add the summary line container (test id `run-summary`) directly under `<graph-replay>` in the Working panel, and in `P/main.ts` render it from each `replaychange` state
- [x] T017 [P] [US1] Create `tests/unit/summary.test.ts`: the leader named equals the leaderboard's leader for several attempt sets (language model vs rival, ties, rejected attempts); the pre-run sentence; the data error replaces the line
- [x] T018 [US1] Add e2e cases to `tests/e2e/tabs.spec.ts`: on first load the Working tab is shown, Data is the first tab, Working holds the intro, picker, graph and summary and none of the result containers' content; during a run the summary names the leader and links to `#found`; a data-error run (use the existing way tests force one) shows the error on Working

---

## Phase 5: User Story 3 - Tabs are links, and switching loses nothing (P1)

**Goal**: each tab has a link; Back and Forward work; a run and every tab's state survive switching.
**Independent test**: switch tabs mid-run; the run neither restarts nor pauses.

- [x] T019 [US3] Check the hidden-Working risk (research decision 2): in `G/graph-replay.ts` guard the marker animation (`getTotalLength`) and the height fit (`fitHeight`) so a hidden or zero-size graph neither throws nor redraws to nonsense, and so playback keeps advancing and the final state is reached; make the smallest change that passes T020
- [x] T020 [US3] Add e2e cases: every tab opens from its link; Back and Forward move between visited tabs; opening `#final-test` before any run shows the not-ready sentence and the link to Working; starting a run, switching to Data and other tabs mid-run does not restart or pause it, and playback keeps advancing while Working is hidden (the timeline reaches its last step); typed try-your-own inputs and scroll positions survive switching
- [x] T021 [US3] Confirm in `P/tryit.ts` that the form keeps what the visitor typed when tabs switch and when a new run starts (the form is hidden, not rebuilt); change it only if T020 shows it resets

---

## Phase 6: User Story 4 - Moving to the results when the run finishes (P1)

**Goal**: the page switches to What the agent found once per run when the replay reaches its end, with focus on the heading.
**Independent test**: a full run ends on What the agent found; pausing delays it; stepping back and forward does not repeat it; a failure does not switch.

- [x] T022 [US4] Create `P/readiness.ts`: pure `step(prev, detail, active) -> { state, actions }` per data-model.md and plan.md (new `run` resets all result tabs and clears `switched` and leaves the current tab alone; found ready on an attempt or a reasoning round at the displayed step; final ready on the final state at the displayed step; try-your-own ready when `finalState` holds a model; marker set when ready and the tab is not showing; at `atEnd` with `failed` false, no data error and `switched` false emit switch-to-found with focus and set `switched`)
- [x] T023 [P] [US4] Create `tests/unit/readiness.test.ts`: switches exactly once at the end; no switch before the end, after a pause, on failure or with a data error; no second switch after stepping back and forward or jumping; reset on a new run without a switch away from the current tab; readiness of each tab; marker set only for a tab not showing; a switch from the Data tab still happens; the marker latches when the visitor steps back while the not-ready flag follows the displayed state; `failed` (error or lost connection) never switches
- [x] T024 [US4] In `P/main.ts` run the machine on each `replaychange` and carry out its actions: `select("found", { focus: true })`, `setMarker`, and showing or hiding each result tab's not-ready paragraph; pass the active tab id from `tabs.active`; clear a tab's marker on `tab-show`; the marker latches and the not-ready paragraph follows the displayed state (plan "Readiness")
- [x] T025 [US4] Add e2e cases: a full run switches to What the agent found when playback reaches the end with focus on its heading; pausing one step before the end delays the switch until stepping to the end; stepping back and forward afterwards does not switch again; being on the Data tab at the end still switches; a data-error run does not switch; a second run switches again at its end

---

## Phase 7: User Story 5 - Tabs that are not ready yet (P2)

**Goal**: not-ready sentences, markers and the link to The final test.
**Independent test**: before a run each result tab shows one sentence and a link; markers appear when ready and clear when opened.

- [x] T026 [US5] Make the not-ready paragraphs (written in T010) show or hide from the readiness actions (T024) so that they follow the step on display, and a new run restores them; check the wording of the three sentences reads well and each links to `#working`
- [x] T027 [US5] In `P/results.ts` (`renderFound`) add the link to `#final-test` once the final state exists; confirm it appears only then
- [x] T028 [US5] Add e2e cases: before any run each result tab shows its sentence and a link to Working and can be opened; What the agent found fills in as steps are shown; markers appear when tabs become ready and clear when opened (check the visually hidden text, not colour); a new run while on a result tab returns the result tabs to not ready and leaves the visitor there, and the switch happens again at the new run's end; the link to The final test appears once it is ready

---

## Phase 8: User Story 6 - Keyboard, screen reader, phone (P2)

**Goal**: usable by keyboard and announced correctly; phone width without sideways page scroll; no animation.
**Independent test**: keyboard-only navigation; all five tabs reachable at 390px with no page-level horizontal scroll.

- [x] T028a [US5] Add e2e cases to `tests/e2e/tabs.spec.ts`: stepping back before The final test's step shows its not-ready sentence again while its marker (if not yet opened) stays; opening a result tab's link while a run is in progress shows what is ready so far, or the sentence if nothing is ready yet
- [x] T028b [US5] Add an e2e case with the existing fake-model failure setup (`fake/broken`): What the agent found shows the rival's results and the "language model did not take part" notice, the switch still happens at the end of the replay, and the other tabs behave as before; and one with a dropped connection (existing way tests drop it) showing no switch and the message on Working
- [x] T029 [US6] Add e2e cases: keyboard-only navigation (focus a tab, arrow keys, Home, End, Enter or Space) reaches and opens every tab; the live region text after the automatic switch and that the heading really holds focus once the panel is shown; at 390px width all five tabs are reachable (scroll the tab list), the selected tab is in view, and `document.documentElement.scrollWidth <= window.innerWidth`; with `reducedMotion: "reduce"` nothing about switching or markers animates (no transition or animation on the tab list or markers)

---

## Phase 9: Polish

- [x] T030 Update the existing e2e tests listed in T001 so they open the right tab (`#found`, `#final-test`, `#try-your-own`) before asserting results; change nothing else in them
- [x] T031 [P] Update `README.md` (page layout section, if it describes the page) and `src/tab-set/` header comment to describe `select`, `setMarker`, the live region and the scrolling tab list; update `src/graph-replay/README.md` for the `run` and `failed` fields of `replaychange`
- [x] T032 Run `npx tsc --noEmit`, `npm run test`, the full Playwright suite and the backend suite (`uv run python -m pytest -q` in `apps/linear_regression`); fix anything left
- [x] T033 Run `quickstart.md` by hand at desktop and phone width, light and dark themes

---

## Dependencies and order

- T001 first. Phase 2 (T002-T007) before every story; T002, T003, T007 are independent of each other, T004 and T005 follow T003 (same file), T006 after T003-T005.
- US2 (T008-T014) first: the structure every other story needs. T008 → T009 → T010; T011 → T012.
- US1 (T015-T018) needs T008-T012 and T007.
- US3 (T019-T021) needs US2.
- US4 (T022-T025) needs T002, T003, T004, T008-T012; T022 before T023 and T024.
- US5 (T026-T028b) needs US4's wiring (T024).
- US6 (T029) needs T005 and T024.
- Polish last; T030 can start once US2 is in, but finish it before T032.

## Parallel opportunities

- T002, T003 and T007 together (different files).
- T006 with T008-T010 once T003-T005 are done.
- T015 and T017, then T013 alongside T016.
- T023 alongside T022's wiring once T022 exists.
- T031 alongside T030.

## Implementation strategy

- **MVP**: Phases 1-3 (the five tabs with every result in one of them), then US1 for the summary line; each phase leaves the suites green (with T030 outstanding until the end) and can be committed on its own.
- Then US3 (safety of switching), US4 (the automatic switch), US5, US6, polish.
- If T019/T020 show the graph misbehaving while hidden, fix that before US4, since the switch relies on playback advancing while the visitor is on another tab.
