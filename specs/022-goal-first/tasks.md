# Tasks: Goal First

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [contracts/page-contract.md](contracts/page-contract.md), [quickstart.md](quickstart.md), [design/README.md](design/README.md)
**Tests**: Requested by the spec and the plan (new and rewritten specs are listed there), so test tasks are included.

Paths are relative to the repo root. `APP` = `apps/linear_regression`; `BE` = `APP/backend/linreg`; `WEB` = `APP/web`; `PG` = `WEB/src/page`; `GR` = `WEB/src/graph-replay`; `E2E` = `WEB/tests/e2e`; `UNIT` = `WEB/tests/unit`; `PYT` = `APP/tests`.

**Format**: `- [ ] T### [P?] [Story?] Description with file path`. `[P]` = different files, no dependency on an unfinished task.

**Stories** (from the spec):
- **US1** (P1) Understand the question and the goal first: hero, goal card, Start button
- **US2** (P1) Choose the AI, press play, and watch it work: player, graph, Right now, feed
- **US3** (P1) See the result only when my run finishes: verdict, Your turn and Scorebook locks, result strip
- **US4** (P2) A refused or failed run is clear and recoverable
- **US5** (P2) The recorded run is gone: leftovers, the other page, preview tags

---

## Phase 1: Setup

- [x] T001 Run all suites (`uv run pytest` in `APP`; `npx tsc --noEmit`, `npx vitest run` and `npx playwright test` in `WEB`) and confirm they are green on `bf9d390` before any change; note any failure in `specs/022-goal-first/quickstart.md`

---

## Phase 2: Foundational (blocks every story)

### Backend (plan step 1)

- [x] T002 Add the `tasks` stream mode to `run_events` in `BE/graph_api.py` and emit `event: start` `{step, node}` for each task-start chunk (one with `input` and no `result`), before that node's `step`; leave `step`, `done`, `error` and every other behaviour unchanged; keep the module free of any node or app name
- [x] T003 [P] Write `PYT/test_start_events.py`: for the real graph (fake model) each `step` is preceded by its `start` with the same number and node, `done` comes last, a failing node gives `start` then `error` and no `step`; the same for a tiny generic test graph
- [x] T004 Update `PYT/test_api.py` (and any other test counting events, found with `grep -rn "event: step" APP/tests`) for the added `start` events; add a test that `/api/run` with no `model` parameter uses the owner's default model (the run's `model_name`)
- [x] T005 [P] Add `doing_lines(test_year)` to `BE/wording.py` (one plain-words line per node, from the term list and the test season, wording in [research.md](research.md) R4) and send it as `doing` from `structure_extras` in `BE/stage_info.py` (test year from the rolling checks as `general_note` does, fallback "the test season")
- [x] T006 Extend `PYT/test_stage_info.py` (every node of the graph has a non-empty `doing` line; none has a banned name; the final-test line carries the test year) and regenerate `WEB/tests/fixtures/linreg-structure.json` from the live response so `PYT/test_structure_stages.py` passes
- [x] T007 [P] Add `goal_card(goal, figures, training, test)` to `BE/hero_text.py` and send `goal_card` and `test: {year, innings}` from `BE/reference_api.py` (counts only, no test rows; on the failure path only `kicker` and `sentence`, `test` null); extend `PYT/test_hero_text.py` and `PYT/test_reference_api.py`; regenerate `WEB/tests/fixtures/under-the-hood-reference.json`
- [x] T008 [P] Add `result_strip` `{label, text}` to `build()` in `BE/headlines.py` using the same case and one-decimal misses as `vs_search`; extend `PYT/test_headlines.py` and regenerate `WEB/tests/fixtures/headline_cases.json` by rewriting each case's `expected` from `headlines.build(**inputs)`
- [x] T009 Extend `PYT/test_wording_no_banned.py` to check `doing_lines`, `goal_card` and `result_strip` for banned names and to use the fake-run fixture (T011) in place of the recorded run

### Remove the recorded run (plan step 2)

- [x] T010 Create `PYT/make_fake_run.py` (builds the scripted fake-model run's events in process with `graph_api.run_events`, no network) and `PYT/test_fake_run_fixture.py` (fails if the fixture differs from a fresh build); `git mv WEB/tests/fixtures/recorded-run.fake.json WEB/tests/fixtures/fake-run.json`, keep only `model_name`, `events` and `done`, and regenerate it
- [x] T011 Delete `WEB/public/recorded-run.json`, `APP/scripts/record_run.py`, `APP/scripts/reword_recorded_run.py`, `PYT/test_recorded_run.py`, `PYT/test_reword_script.py`, `PYT/test_fake_recording.py`, `E2E/recorded-run.spec.ts`, `UNIT/recorded.test.ts`; remove the `/recorded-run.json` header from `APP/vercel.json`; update the docstring of `BE/wording.py` and the recorded-run and live-panel bullets of `APP/README.md`
- [x] T012 Point the unit tests that read the old fixture (`UNIT/found-view.test.ts`, `found-choice.test.ts`, `stage-colours.test.ts`, `under-the-hood-figures.test.ts`, and any other found with `grep -rn "recorded-run" WEB/tests`) at `fake-run.json`; run `npx vitest run`
- [x] T013 Rewrite `E2E/helpers.ts`: add `runToEnd(page)` (open `/`, press "▶ Start the experiment", press "▶ Play", wait for "Finished with"), `fakeRun(request, visitor)` (fetch `/api/run` as a separate visitor and return `{events, state}`), `serveRun`/`sseFrom(events)` built from the fixture; remove `finishRun`/`toPlayer`; mark the e2e specs that still depend on the old page `test.describe.fixme` with a comment naming the task that rewrites them (none may stay `fixme` at the end: T054)

### Run state (plan step 3)

- [x] T014 Create `PG/run-state.ts`: the page-level run state of [data-model.md](data-model.md) (phase idle/running/finished/failed, `current`, `last`, `message`, `model`), the transitions (press, opened, start, step, final test, done, refused, failed), and the derived button, select-disabled, locks (with variants before/during/failed), status text and Right now values; pure and storing nothing
- [x] T015 Write `UNIT/run-state.test.ts`: every transition; `last` set at the final test and kept across a second run and a failed second run; a failed first run leaves everything locked with the failure variant; refusal returns to the previous phase with the message; button, status and locks per phase; nothing in `localStorage`/`sessionStorage`
- [x] T016 Delete `PG/run-source.ts`, `PG/player-state.ts`, `UNIT/run-source.test.ts`, `UNIT/player-state.test.ts` (their cases are carried into T015); fix the imports that break (`watch.ts`, `main.ts`, `hero.ts`, `verdict.ts`, `tryit.ts`, `scorebook.ts`) with the minimum needed to compile, leaving the new behaviour to the stories

**Checkpoint**: backend sends `start`, `doing`, `goal_card`, `result_strip`; the recorded run is gone; the run state exists and is tested; Vitest and pytest pass.

---

## Phase 3: User Story 1 - Understand the question and the goal first (Priority: P1)

**Goal**: the page opens on the question, the goal and a Start button, with no result.
**Independent test**: `E2E/idle.spec.ts` passes at 390 × 664.

- [x] T017 [US1] Add `goal_card` and `test` to `PG/reference-types.ts` and create `PG/goal-card.ts`: draw the goal card (kicker, goal sentence, the TV figure with its label, the "{n}+" figure, "Judged on…") from the server's words, and the result strip (shown only when the run state has a `last`) linking to `#verdict`; on the failure path show the sentence only
- [x] T018 [P] [US1] Write `UNIT/goal-card.test.ts` (replaces the deleted scoreboard test): the card and the strip are exactly the server's words; no agent figure without a `last`; the failure-path card
- [x] T019 [US1] Rewrite the hero section skeleton in `WEB/index.html` (kicker, h1, lead, Start link, goal card slot, `id="problem"` on the problem section, `#try` and `#watch` ids) and set the new preview tags (title "Can an AI agent beat the TV at predicting a T20 score?", description inviting the reader to choose an AI and watch it try)
- [x] T020 [US1] Rewrite `PG/hero.ts`: fixed kicker (term-built), h1 and lead from the contract, "▶ Start the experiment" (a link to `#watch` whose click scrolls and focuses `model-select`), the goal card, the result strip, and the Commentary (TV on past innings, "why a season it never sees", who does what); delete `PG/scoreboard.ts` and move the `Headlines` type to `PG/headlines.ts`; fix its imports
- [x] T021 [US1] Update `PG/main.ts` to draw the hero from `/api/reference` and the run state only (no recorded loading); add the goal-card, hero and Start styles to `PG/simple.css` on existing tokens (48 px Start target, first screen at 390 × 664)
- [x] T022 [US1] Write `E2E/idle.spec.ts` (replaces `first-screen.spec.ts`, which is deleted): at 390 × 664 the h1, goal sentence and Start button are visible without scrolling, no horizontal scroll, no agent figure, no "Recorded" text, no request for a recorded file; Start moves to the player and focuses the select; the goal card's figures equal `/api/reference`; reload returns to idle
- [x] T023 [US1] Rewrite `E2E/hero.spec.ts` for the new hero (kicker, h1, lead, goal card figures and label with years, hero Commentary closed until Show me everything and its three parts, no "Try your own innings" link); remove the cases of the old Scoreboard card

**Checkpoint**: the idle page is the question and the goal; US1 is shippable alone (the player below still stubbed).

---

## Phase 4: User Story 2 - Choose the AI, press play, and watch it work (Priority: P1)

**Goal**: a real live run the reader starts, watched on the graph as it goes.
**Independent test**: `E2E/player.spec.ts` and `E2E/graph-run.spec.ts` pass on the fake models.

### Shared graph component (plan step 5)

- [x] T024 [US2] In `GR/sse.ts` parse the `start` event and add an optional `onStart(e: {step, node})` to `StreamHandlers`; extend `UNIT/sse.test.ts`
- [x] T025 [US2] In `GR/buffer.ts` add `inProgress`, `follow` (the cursor follows arrival from a live start until `done`/`error`; replay keeps its pace) and `failedNode`; `start` sets `inProgress`, the node's `step` clears it; extend `UNIT/buffer.test.ts` for both modes (a streamed step shows at once with no added delay; a replay keeps the pace) and the one-ringed-node rule
- [x] T026 [US2] In `GR/graph-replay.ts`, `GR/rows-view.ts`, `GR/styles.ts` and `GR/structure.ts`: node states `idle`/`running`/`done`/`error` as `data-state` (running = 3 px accent ring with `aria-current="step"`, done = green, error = a distinct border and shape as well as colour; language-model nodes keep dashed purple), wired to `onStart`; replay rings the node of the step shown until the last step; expose a `structure` getter and `inProgress`/`stoppedAt` in `replaychange`; keep the component free of cricket words; extend `UNIT/graph-replay-generic.test.ts` (including another app's structure)

### The player and the page

- [x] T027 [P] [US2] Create `PG/player.ts`: the labelled "Choose the AI" select filled from `/api/models` (names and notes only, default marked and first, note linked with `aria-describedby`, disabled while running; "Default model" and the model-list-failed note when the list cannot load, and the run then starts with no model), the "▶ Play" / "Running…" / "▶ Run again" + "Watch it again" buttons (48 px), the fixed run line, the shown status line (`player-status`, not a live region), the hidden polite announcement region (`player-announce`, phase changes and AI-step/code-step changes only), and the `role="alert"` message slot; delete `PG/live-panel.ts`; drop `limitsText` use from `PG/models.ts`
- [x] T028 [P] [US2] Create `PG/right-now.ts`: the "Right now" card (step, doing from `structure.doing`, round "n of up to {ROUND_CAP}" or "—", best so far) and its "Stopped: {reason}" state; stacks below the graph on a phone
- [x] T029 [US2] Rewrite `PG/watch.ts`: h2 "Choose the AI, press play, and watch it work.", loop strip, player, "What makes it an agent?" with legend and its Commentary, the graph shown by default (not in Commentary), Right now, the round feed (empty-state line, rows as 020), the closing "Best idea…" line with the link to `#verdict`, eight-stage legend and Back/Step/Reset/Speed only with Show me everything and a finished run; no autoplay, no recorded run; "Watch it again" replays through the graph with no `/api/run` request; the shown status line follows the node while `player-announce` speaks only phase changes and AI-versus-code changes, and the 020 per-round live region is kept; for a run without the agent the status line says so ("Finished with the brute-force search alone · best {score} on the check seasons")
- [x] T030 [US2] Wire `PG/main.ts`: create the run state, feed it from the graph's `start`/`step`/`done`/`error`/`refused` events, pass it to the player, Right now and the hero's result strip; add the player, status, explainer, legend, Right now and node-state styles to `PG/simple.css` and `PG/commentary.css`
- [x] T031 [P] [US2] Write `E2E/player.spec.ts` (replaces `live-panel.spec.ts`, which is deleted, carrying its model-list cases): idle controls and status; select options and note; Play starts a run with the chosen fake model; select disabled and button "Running…" while running; "▶ Run again" and "Watch it again" after; "Watch it again" makes no `/api/run` request; the run line text; with `/api/models` failing the select shows the default and Play still runs; pressing Play twice quickly starts one run (one `/api/run` request); from page load to a started run takes two actions with the default model preselected (SC-002); a run with no language model reachable says so in the status line and the closing line
- [x] T032 [P] [US2] Write `E2E/graph-run.spec.ts` with `fake/slow`: exactly one node ringed while running (the last started, not completed), done nodes never decrease, after the run none ringed and every visited node done, language-model nodes dashed, Right now's step, doing, round and best, stage legend and replay controls only with Show me everything; each streamed step appears without an added delay; toggling Show me everything mid-run keeps the run going and the graph and feed intact
- [x] T033 [US2] Rewrite `E2E/watch.spec.ts`, `E2E/play.spec.ts`, `E2E/live-region.spec.ts`, `E2E/llm-run.spec.ts` and `E2E/stages.spec.ts` for the new player (drive `runToEnd` or the fixture stream; keep every behaviour they covered that still exists: round feed rows, reasoning as written, per-round announcement, stage legend and notes, fallback notices); remove their `fixme`

**Checkpoint**: the reader can press play and watch the run; US2 works alone with the old verdict below it.

---

## Phase 5: User Story 3 - See the result only when my run finishes (Priority: P1)

**Goal**: verdict, Your turn and the run-dependent Scorebook cards locked until a run's final test, kept across later runs.
**Independent test**: `E2E/locks.spec.ts` passes.

- [x] T034 [US3] Create `PG/locked.ts`: the locked card element (dashed, lock icon `aria-hidden`, heading, body, optional link to `#watch`) and the wording for before / during / failed from the contract, with the test year from the reference
- [x] T035 [US3] Change `PG/verdict.ts`: render the locked card until the run state has a `last`, then 020/021's verdict from `last` with the agent's bar label "AI agent ({model})" (in `PG/verdict-bars.ts`), redrawn on every later step so the takeaways fill in; a failed first run shows "The run didn't finish: {reason}. Press play to try again, or choose another AI."; a later run (running or failed) keeps showing `last`
- [x] T036 [P] [US3] Change `PG/tryit.ts` to show the locked card ("Run the experiment first. Your turn uses the model the agent builds." with a link to `#watch`) until a `last` exists, then the form unchanged
- [x] T037 [P] [US3] Change `PG/scorebook.ts`: "Every idea tried" and "The agent graph, step by step" show "Available after a run" and do not open (`aria-disabled`, no click effect) until a `last`; "The data" and "How this app was built" unchanged; the card names stay defined once in its card list
- [x] T038 [US3] Wire the result strip and the closing line of the player to `last` in `PG/main.ts` (strip shown after a finished run, gone on reload); `#verdict` and `#try` anchors land on the locked cards before a run
- [x] T039 [US3] Write `E2E/locks.spec.ts`: before a run all four are locked with the "before" wording and the test year; during a run the verdict reads the "during" wording; after the run all four are unlocked within a second of the final test and the strip appears; a second run keeps the first run's results until its final test replaces them; a failed first run keeps everything locked with the failure wording; a failed second run keeps the first's results; a reload returns to locked; `#verdict` and `#try` links land on locked cards; a run that finishes while the page is scrolled elsewhere updates the status line, the hidden announcement and the strip without moving the page
- [x] T040 [US3] Rewrite `E2E/verdict.spec.ts`, `E2E/tryit.spec.ts` and `E2E/scorebook.spec.ts` to run a fake-model run (or serve a fixture stream for the result cases: beat, edged, held, no model) instead of routing a recorded file; remove their `fixme`; add the bar label "AI agent ({model})"
- [x] T041 Measure the word counts early: extend `E2E/word-count.spec.ts` to print the main page before a run and after a fake-model run (simple and everything open, 390 px, the agent's reasoning excluded), run it now that the hero, player, locks and verdict exist, and record the numbers in `specs/022-goal-first/quickstart.md`; if either state is over its limit, cut copy now in the order in [research.md](research.md) R11, before the remaining specs are rewritten

**Checkpoint**: the story is complete: question, play, watch, result.

---

## Phase 6: User Story 4 - A refused or failed run is clear and recoverable (Priority: P2)

**Goal**: refusals and mid-run failures are clear and leave the page usable.
**Independent test**: `E2E/failure.spec.ts` passes.

- [x] T042 [US4] Handle refusal in the player: show the gate's message in the `role="alert"` slot (hourly and daily wording as the server sends it), return the state to its previous phase, re-enable the select and Play, and keep any earlier results; `model_not_allowed` reloads the list and selects the default with the note to press play again
- [x] T043 [US4] Handle a run that stops part-way: on `error` or a lost connection set the run state to failed with the reason, mark the node that was running with the error state in the graph, show "Stopped: {reason}" in Right now, keep the rounds already in the feed, return the button to "▶ Play" or "▶ Run again", and show the failure message beside the player
- [x] T044 [P] [US4] Write `E2E/failure.spec.ts`: a refused run (use a low per-visitor limit or a served 429 body) shows the alert and leaves the page usable; `fake/broken`, `fake/timeout` and a stream cut mid-run (served) give the error node, "Stopped: …", the rounds already shown, and the right locks; a model no longer on the list falls back to the default; after a failed second run "Watch it again" replays the earlier finished run
- [x] T045 [P] [US4] Extend `UNIT/run-state.test.ts` and `UNIT/buffer.test.ts` with the refusal and failure cases if T015 and T025 did not already cover them

**Checkpoint**: every failure path leaves the page recoverable.

---

## Phase 7: User Story 5 - The recorded run is gone (Priority: P2)

**Goal**: no trace of the recorded run in the product or the pages' text.
**Independent test**: a repository search and the static checks pass.

- [x] T046 [US5] Remove every mention of a recorded run from `WEB/under-the-hood.html` (and its fixture-driven text such as the "The page loads" row if it lists the file), and from the comments and strings in `PG/found/view.ts`, `PG/round-feed.ts`, `GR/*.ts`; run `grep -rniI "recorded" APP --include=*.ts --include=*.py --include=*.html --include=*.json --include=*.md --exclude-dir=node_modules --exclude-dir=dist` and fix every hit that is not history in `specs/`
- [x] T047 [P] [US5] Update `PYT/test_preview_tags.py`, `PYT/test_static_terms.py` and `E2E/preview-tags.spec.ts` for the new title and description (no recorded route), and `E2E/under-the-hood.spec.ts` for the removed mentions
- [x] T048 [P] [US5] Add an end-to-end check (in `E2E/idle.spec.ts` or a small `E2E/no-recorded.spec.ts`) that neither page requests a recorded file and no text mentions one, before and after a run
- [x] T049 [US5] Rewrite `E2E/banned-terms.spec.ts`, `E2E/brute-force.spec.ts` and `E2E/terms-brackets.spec.ts` to run on a finished fake-model run (`runToEnd`) with everything open and every Scorebook panel open, collecting the new text (goal card, explainer, legend, Right now, locked cards, status line, strip); remove their `fixme`; the self-test stays
- [x] T050 [P] [US5] Rewrite `E2E/contrast.spec.ts`, `E2E/data-tab.spec.ts`, `E2E/detail-level.spec.ts` and `E2E/navigate.spec.ts` where they used the recorded run or the old card, and check the contrast of the new elements (goal card, status line, ring, done and error node styles, locked cards, strip) in both themes; remove their `fixme`

---

## Phase 8: Polish and cross-cutting

- [x] T051 Extend `E2E/word-count.spec.ts` to measure the main page before a run and after a fake-model run (simple and everything open, 390 px, the agent's reasoning excluded) and the built page, printing each; run it and fill the table in `specs/022-goal-first/quickstart.md`
- [x] T052 If any count is over 500 (simple) or 1,200 (everything open), cut copy in the order in [research.md](research.md) R11 (never the question, the goal sentence, the status wording or the control labels), record each cut in `specs/022-goal-first/quickstart.md`, and update the tests that assert the cut text
- [x] T053 Check the first screen at 390 × 664 (h1, goal sentence and Start visible, no horizontal scroll, 44 px targets, 48 px Play) in `E2E/phone.spec.ts` for the idle page and the page after a run
- [x] T054 Run `npm run build` in `WEB` and confirm no reference to a removed file remains; run `uv run pytest`, `npx tsc --noEmit`, `npx vitest run` and `npx playwright test`; confirm `test_no_test_year_leak` is green and no test is left `fixme` or skipped (`grep -rn "fixme" WEB/tests`)
- [x] T055 Walk the page in a real browser in light and dark themes (idle, running with `fake/slow`, finished, refused, failed) with the fake server, read it once for one name per concept (feature 021), and note anything the checks cannot see in `specs/022-goal-first/quickstart.md`
- [x] T056 Update `APP/README.md` (the goal-first flow, the `start` event, the fake-run fixture helper) and tick the design's open questions as answered in `specs/022-goal-first/design/README.md` notes if the owner wants them recorded there

---

## Dependencies

```text
Phase 1 → Phase 2 (backend, removal, run state) ─┬→ US1 (Phase 3) ─→ US2 (Phase 4) ─→ US3 (Phase 5) ─→ US4 (Phase 6)
                                                  └──────────────────────────────────────────────────→ US5 (Phase 7, after US3 for the rewritten specs)
                                                                                                         → Polish (Phase 8)
```

- Phase 2 blocks everything. Inside it: T002 → T003, T004; T010 before T009 and T012; T011 before T012 to T016; T013 before any e2e rewrite; T014 before T015, T016.
- US2 needs US1's `main.ts` wiring and the hero's Start target (the select); US3 needs US2's run state events; US4 needs the graph's error state (T026) and the player (T027); US5's spec rewrites need US2 and US3 to exist.
- Inside US2: T024 → T025 → T026 (shared component) before T029; T027 and T028 can run alongside them; T030 after T029.
- No task leaves a `fixme`: T033, T040, T049 and T050 remove them; T054 checks.

## Parallel examples

- Phase 2 backend: T003 with T005, T007, T008 (different files) once T002 is done.
- US2: T027 and T028 together (two new files); T031 and T032 together (two new specs).
- US3: T036 and T037 together.
- US5: T047, T048 and T050 together.

## Implementation strategy

1. **MVP = Phases 1–4** (backend, removal, run state, the hero, the player and graph): a reader can read the goal, press play and watch the run; the old verdict below is replaced in US3.
2. Add US3 (locks and result), then US4 (failures), then US5 (leftovers, preview tags, specs on the new page), then Polish.
3. Run the full suites at each checkpoint (end of T016, T023, T033, T041, T045, T050) and at T054.

**Counts**: 56 tasks. Setup 1, Foundational 15, US1 7, US2 10, US3 8, US4 4, US5 5, Polish 6 (T051–T056).
