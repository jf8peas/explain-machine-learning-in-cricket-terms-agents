# Tasks: "What the agent found" Tab Redesign

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/found-tab.md](contracts/found-tab.md), [research.md](research.md), [design/README.md](design/README.md) (authoritative for copy and layout)
**Tests**: requested in the planning brief (pytest, Vitest with fixture states, Playwright with the fake model).
**Paths**: all relative to `apps/linear_regression/` unless stated.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5 from the spec

---

## Phase 1: Setup

- [x] T001 Read the current tab code and its tests to confirm what the rewrite touches: `web/src/page/results.ts`, `leaderboard.ts`, `grid.ts`, `grid-view.ts`, `main.ts`, `web/tests/unit/grid.test.ts`, and grep `web/tests/e2e/` and `tests/` for `leaderboard`, `check-error`, `grid-cell`, `round-item`, `model-reason`, `attempt-row`, `setup-chip`; list in a scratch note which specs need updating
- [x] T002 Create the empty folder `web/src/page/found/` and a fixtures file `web/tests/unit/found-fixtures.ts` exporting state builders: an AI run (rounds with fitted/rejected/finished/failed outcomes, LLM attempts with `improved`, `split`, `baseline_validation_mae`), the same state after `grid_search` (adds `grid` with 24 cells including a not-allowed cell, `forward_best`, forward attempt, `llm_best`, `validation_winner`), a tie variant, a no-LLM variant (`llm_status: "not_used"`, `llm_failure`), an all-rejected variant (`llm_status: "ok"`, every round rejected or finished, no LLM attempts), and a display-tie variant (AI and rival bests equal when rounded to one decimal, with the recorded winner `forward`)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T003 [P] Add a `short` field to `Option` and to every window, weighting and training-innings option in `backend/linreg/setup_settings.py`; serve `{id, label, short}` from `public_menus()`; add `grid_combinations()` returning the product of the three menu sizes
- [x] T004 Add `round_cap` (`state.ROUND_CAP`) and `grid_combinations` to the `/api/catalogue` body in `backend/linreg/catalogue_api.py` (depends on T003)
- [x] T005 [P] Update `tests/test_api_catalogue.py` and `tests/test_setup_settings.py`: `round_cap == ROUND_CAP`, `grid_combinations` equals the product of the menu sizes and the count of `selection.GRID`, every option has a non-empty `short` unique within its menu, existing keys unchanged (depends on T003, T004)
- [x] T006 [P] Extend the types in `web/src/page/setup.ts` (`MenuOption.short`, a `menuShortLabeller`) and `web/src/page/catalogue.ts` (`Catalogue.round_cap`, `Catalogue.grid_combinations`; export `menuShort` and getters for the loaded counts)
- [x] T007 Write the pure derived view in `web/src/page/found/view.ts` per [data-model.md](data-model.md): join fitted rounds to the `proposer === "llm"` attempt with the same round; `RoundView` (kind, miss, improved, drop from rounded values, clueChange `same`/`added`, isBest); best-so-far points from improved LLM attempts; rival present only when `grid`/`forward_best` exist; TV; `Winner` (pending, ai, rival, tie, gap from displayed values; follows the recorded `validation_winner`; `tie` only when displayed misses are equal and the winner is `llm`; equal displayed values with winner `forward` gives rival, gap 0.0 and `belowDisplay`; rival when no LLM attempts); fallback flag (no LLM attempts and status `not_used` or `failed`; an all-rejected run with status `ok` is not the fallback but still has no AI best line and names the rival)
- [x] T008 [P] Vitest for the view in `web/tests/unit/found-view.test.ts`: joining rounds to attempts incl. rejected, finished and failed; "+ clue" vs "Same clues" against the previous fitted round; best-so-far points; rival absent before grid_search and present after; winner pending/ai/rival/tie and gap from rounded values; the display-tie variant with winner `forward` gives rival with `belowDisplay`, not tie; the all-rejected variant has no best-so-far points and winner rival; fallback with no LLM attempts (depends on T002, T007)
- [x] T009 Create the composer `web/src/page/found/index.ts` exporting `renderFound(target, state, catalogue)`: empty target when there is nothing to show (the tab's "not ready" sentence stays); otherwise the header (h2 "What the agent found", README lead, no eyebrow) then the six sections in order by calling the section modules (stub each call until its story task lands); each section is a `section` with `data-testid="found-section-N"` and an `h3` "N. …"; no `details` elements
- [x] T010 Wire the composer: in `web/src/page/main.ts` call `renderFound` from `found/index.ts` with the loaded catalogue (render once `loadCatalogue()` resolves and on every replay step); remove `renderFound` from `web/src/page/results.ts`; keep `renderFinal` and its helpers unchanged
- [x] T011 Trim `web/src/page/leaderboard.ts` to keep only `Attempt`, `RoundNote`, `leader()` and `proposerName` (remove `renderLeaderboard` and `renderRounds`); delete `web/src/page/grid-view.ts` and `web/src/page/grid.ts`; confirm `web/src/page/summary.ts` still imports `leader` and `proposerName` unchanged
- [x] T012 Add the shared CSS for the found tab in `web/index.html`: section heading style (h3 about 22 px, h2 about 34 px), card, tinted strip, method-colour outlines with `--m-llm`, `--m-forward`, `--tv`, `--surface`, `--border`, `--muted`; remove the old leaderboard/rounds/grid-table CSS and the `section[data-testid=leaderboard]` rules; reword the "not ready" sentence to name the new sections; stack everything below a narrow breakpoint; no animation

**Checkpoint**: the app builds, the tab shows the header and numbered empty-state sections, the summary line still works.

---

## Phase 3: User Story 1 - Understand the contest after a run (P1) 🎯 MVP

**Goal**: sections 1, 2, 6 and the winner panel read correctly after a finished run.
**Independent test**: with the finished fixture state, the header, sections 1 and 2, the winner panel and the ranking table show the right words and figures.

- [x] T013 [P] [US1] Implement `web/src/page/found/contest.ts`: AI card ("up to N tries", N from `catalogue.round_cap`), rival card ("N candidate models", N from `catalogue.grid_combinations`), README copy for each, the small print, and the strip with "Why have a rival?" and "What's a candidate model?" (`contest-ai`, `contest-rival`, `contest-why`, `contest-setup`)
- [x] T014 [P] [US1] Implement `web/src/page/found/seasons.ts`: learning segment from `split.first_year` to the year before the first check, one segment per check (`data-year`), a dark "final test, locked" segment with `split.test_year`, the README lead and small print with years from state; wraps the learning segment onto its own row on a phone
- [x] T015 [P] [US1] Implement `web/src/page/found/ranking.ts`: columns #, Candidate model (features via `labelFor` plus setup words from `menuLabel`), Found by ("AI agent" / "Rival" in the method colour with a word), Average miss; rows = LLM attempts plus allowed grid cells' bests, not the `forward_selection` attempt; sort ascending, ties LLM first then grid order; `attempt-row` with `data-proposer`; the "TV projection missed by …" line (`ranking-tv`); table inside a scrolling box; no per-season column
- [x] T016 [US1] Implement the winner panel in `web/src/page/found/race.ts` (export `renderWinnerPanel(view)`): "Goes forward to the final test", big line, sentence with both misses and the gap from displayed values, the tie wording (only when displayed misses are equal and the recorded winner is the AI) and, for equal displayed values with the rival recorded as winner, "the gap is smaller than the display shows", `data-state` `ai` for state `llm` and `rival` for state `forward`, "Chosen before the final test season was touched. Both candidate models still sit the final test.", the `to-final` link to `#final-test`, tinted in the winner's colour with the winner named in words, `data-state` pending/ai/rival/tie, and "still searching" before `validation_winner` exists
- [x] T017 [US1] Replace the stubs in `found/index.ts` with `contest`, `seasons`, the winner panel (inside section 3 until the chart lands) and `ranking`
- [x] T018 [P] [US1] Vitest `web/tests/unit/found-ranking.test.ts`: ordering, tie rule (LLM first, then grid order), the forward attempt not listed twice, not-allowed cells excluded, no per-season column (depends on T015)
- [x] T019 [P] [US1] Vitest `web/tests/unit/found-contest.test.ts`: round cap and combination count come from the catalogue argument, season segments from the split, winner panel wording for ai, rival, tie, below-display gap and pending (depends on T013, T014, T016)

**Checkpoint**: sections 1, 2, 6 and the winner panel work and are testable on their own.

---

## Phase 4: User Story 2 - Follow the race and each AI round (P1)

**Goal**: the race chart and one card per round.
**Independent test**: every chart mark, round card and quoted reason matches the fixture rounds.

- [x] T020 [P] [US2] Implement `web/src/page/found/race-layout.ts` (pure): y range that fits every plotted value with gridlines at whole runs, x position per round (1 to the rounds used), and end-label placement through `spreadLabels` imported from `web/src/page/worm-layout.ts`
- [x] T021 [US2] Implement the chart in `web/src/page/found/race.ts` (export `renderRaceChart(view)`): hand-built SVG; filled dot for a new best, open dot for no better, cross labelled "rejected", the word "done" or "failed"; solid AI step line labelled "AI <best>" from improved attempts; dotted rival line labelled "Rival <best>" only when the view has a rival; dashed TV line labelled "TV <value>"; axis titles "AI agent's round" and "Average miss (runs)"; the README caption; the text equivalent (`race-text`) listing every round's outcome and score, the rival's best and the TV's; `race-mark` with `data-round`/`data-kind` and `race-line-*` ids; marks and lines distinguishable without colour (depends on T020)
- [x] T022 [P] [US2] Implement `web/src/page/found/rounds.ts`: one card per round in order with three columns (round number; proposal with clues in bold, "+ <clue>" or "Same clues", setup words as `setup-chip`s, reason as a `blockquote` with `model-reason` set via text; result), results as in the README (average miss with "new best ▼<drop>" or "no better" or "first score"; "✕ Rejected" with code's message; "stopped"; "failed" with the reason), best round outlined in `--m-llm`, rejected dashed and greyed, `round-item` with `data-outcome`, the README lead and small print; `round-item` stacks on a phone
- [x] T023 [US2] Put the chart and winner panel side by side (stacked on a phone) in section 3 and the cards in section 4 in `found/index.ts`
- [x] T024 [P] [US2] Vitest `web/tests/unit/found-race-layout.test.ts`: y range fits all values (incl. all equal, a single round, TV or rival above the AI values), whole-run gridlines, end labels at least the minimum gap apart (depends on T020)
- [x] T025 [P] [US2] Vitest `web/tests/unit/found-rounds.test.ts`: card content for fitted-best, fitted-no-better, first score, rejected, finished, failed rounds; drop computed from rounded values; reasons containing `<b>` or `<script>` appear as literal text; best round marked (depends on T022)
- [x] T026 [P] [US2] Vitest `web/tests/unit/found-race.test.ts`: mark kinds per round, step line points, rival line only after grid_search, TV line from `baseline_validation_mae`, text equivalent mentions every round, the rival and the TV; the all-rejected variant plots crosses or words with no AI line (depends on T021)

**Checkpoint**: sections 3 and 4 complete; User Stories 1 and 2 both work.

---

## Phase 5: User Story 3 - Understand the rival's grid search (P2)

**Goal**: the grids, the best-cell star and the explanation of the two terms.
**Independent test**: cells match the fixture grid; best cell starred.

- [x] T027 [US3] Implement `web/src/page/found/grid.ts`: one real `table` per training-innings choice (caption from the menu label, `th scope="col"` weightings using `short` labels, `th scope="row"` windows using `short` labels), each allowed cell printing its value to one decimal, not-allowed cells "–" with the cell's note as an accessible description (`aria-describedby` to a visually hidden element), stepped tint of `--m-forward` in 5 steps by value rank (darker = smaller miss; allowed cells are ranked by value and split into 5 equal-sized bands, and cells with equal values always share a step), best cell outlined, bold and starred, `grid-table` (`data-innings`) and `grid-cell` (`data-best`); README lead explaining "hyperparameters" and "grid search"; the `grid-best` sentence using plain labels and the best cell's feature labels; no grid before `grid` exists (section shows its lead only)
- [x] T028 [US3] Wire `grid.ts` into section 5 of `found/index.ts`; add the grid table CSS (small tables side by side, stacked on a phone, each grid inside its own scroll box if it cannot fit) in `web/index.html`
- [x] T029 [P] [US3] Rewrite `web/tests/unit/grid.test.ts` as `web/tests/unit/found-grid.test.ts` for the new module: one table per training-innings choice, rows/columns from cells, shading steps ordered by value (5 steps, equal values share a step), the best cell flagged, not-allowed cell shows "–" with its note, best-cell sentence, single-innings grid has no empty placeholder (depends on T027)

**Checkpoint**: section 5 complete.

---

## Phase 6: User Story 4 - Watch the tab fill in as the replay advances (P2)

**Goal**: each section shows only what has happened so far.
**Independent test**: step the replay; later data disappears when stepping back.

- [x] T030 [US4] Audit `found/index.ts` and every section module so they read only the state passed in (no module-level cache of earlier state) and render the pre-state wording when data is absent: winner "still searching", no rival line or grids or rival rows before `grid_search`, round cards only for rounds so far; fix any gap found
- [x] T031 [P] [US4] Vitest `web/tests/unit/found-steps.test.ts`: render the same composer with states cut at (no attempts), (first round fitted), (all rounds, before grid), (after grid_search) and assert what appears and disappears at each; stepping back to an earlier state shows no later data (depends on T009, T017, T023, T028)

---

## Phase 7: User Story 5 - Language model does not take part (P2)

**Goal**: the README fallback.
**Independent test**: with the no-LLM fixture, the AI card, chart, section 4 and winner panel follow the fallback.

- [x] T032 [US5] Implement the fallback in `contest.ts` (AI card says it did not take part and shows `llm_failure` in one line), `race.ts` (chart shows only the rival and TV lines, text equivalent says the AI made no proposals), `found/index.ts` (section 4 is one sentence, `rounds-none`) and the winner panel (names the rival), all driven by the view's fallback flag
- [x] T033 [P] [US5] Vitest `web/tests/unit/found-fallback.test.ts`: no-LLM state and an LLM-failed-with-no-attempts state; AI card line, no AI line or marks, section 4 sentence, winner panel names the rival, ranking has only rival rows (depends on T032)

---

## Phase 8: End-to-end and cross-cutting

- [x] T034 Update the existing specs identified in T001 that targeted the old leaderboard, grid or reasoning blocks (for example the `check-error` expectations in `web/tests/e2e/*.spec.ts`, the old section headings and `grid.test.ts` leftovers); keep `attempt-row`, `round-item`, `model-reason` and `setup-chip` where the element still means the same thing
- [x] T035 Write `web/tests/e2e/found.spec.ts` with the fake model: six numbered sections and no `details` or toggle inside the tab; read the state from the replay event and check every number on the tab (round cap, combinations, years, each round's miss, rival and TV values, gap, drop, grid cells, ranking) against it; winner panel says "still searching" before the grid-search step and names the winner after it; stepping back hides later sections' data; no "Each check year" text or column; the existing markup-in-reason fake model renders as literal text; the race chart has the text equivalent
- [x] T036 [P] Add Playwright cases in `web/tests/e2e/found.spec.ts` for light and dark themes (each renders, method colours accompanied by words) and a 360 px viewport (`document.documentElement.scrollWidth <= clientWidth`, ranking table scrolls inside its own box)
- [x] T037 [P] Add a no-LLM Playwright case in `web/tests/e2e/found.spec.ts` using the existing way of running without a model (fallback card line, chart without an AI line, one-sentence section 4, winner panel names the rival)
- [x] T038 Run all three suites from [quickstart.md](quickstart.md) (`python -m pytest`, `npm run test`, `npx playwright test`) and fix failures; confirm no other tab, the graph or the summary line changed (summary tests pass unmodified)
- [x] T039 Visual pass in the running app against `design/found-tab.html` and the README (copy, spacing, heading style, both themes, 360 px); report anything the README and picture disagree on and follow the README
- [x] T040 [P] Remove dead code and CSS left from the old blocks (unused exports in `leaderboard.ts`, `check-error` styles, old `setup-chips` rules still used elsewhere stay) and update `README.md` in `apps/linear_regression` if it describes the old tab

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. Within Phase 2: T003 → T004 → T005; T006, T008 after T002/T007; T009 → T010 → T011; T012 any time after T001.
- US1 and US2 are both P1 and independent of each other once Phase 2 is done; US2's winner panel is already built in US1 (T016) and is only repositioned in T023.
- US3, US4 and US5 depend only on Phase 2 (US4's test needs the earlier stories' modules wired in; US5 touches `contest.ts`, `race.ts` and the panel, so run it after US1 and US2).
- Phase 8 last.

## Parallel examples

- After Phase 2: T013, T014 and T015 (three files) together; then T020 and T022 together.
- Test tasks marked [P] (T018, T019, T024, T025, T026, T029, T031, T033) can run alongside the next story's implementation.

## Implementation strategy

- **MVP**: Phases 1, 2 and 3 give the header, the contest, the season strip, the winner panel and the ranking. Add Phase 4 for the race and rounds (the heart of the tab) before releasing; Phases 5 to 7 complete the design.
- Commit after each phase; run the Vitest suite after each story and the full three suites at T038.
