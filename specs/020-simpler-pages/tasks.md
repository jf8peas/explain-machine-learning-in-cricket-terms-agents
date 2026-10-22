# Tasks: Simpler Pages: the Agent as the Hero, Detail on Request

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md), and [design/README.md](design/README.md) (source of copy and structure).
**Tests**: requested by the plan, so test tasks are included. Write each story's tests first and see them fail.
**Paths**: relative to `apps/linear_regression/` unless they start with `specs/`. Python tests run with `uv run pytest`; front-end with `cd web && npm test` (Vitest), `npm run build`, `npm run e2e` (Playwright; stop any API on port 8000 first).

## Format: `- [ ] T### [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[USn]**: the user story in spec.md (US1 hero, US2 watch it think, US3 detail switch, US4 verdict and Your turn, US5 Scorebook, US6 built page, US7 preview tags).

## Phase 1: Setup

- [X] T001 Run the baseline and record it in the PR description: `uv run pytest`, `cd web && npm test && npm run build && npm run e2e`; fix nothing, only note any test already failing on `main`
- [X] T002 [P] Create `web/tests/fixtures/headline_cases.json` (empty array placeholder with the schema from `specs/020-simpler-pages/contracts/api.md`) so the shared fixture exists before either side reads it
- [X] T003 [P] Create the empty module folders `web/src/detail-level/` and add `web/src/page/commentary.css` and `web/src/page/simple.css` (empty, imported later) so later tasks can edit them in parallel

---

## Phase 2: Foundational (blocks every user story)

**Backend: words, agent model, rows, limits (plan Phase 1)**

- [X] T004 [P] Write `tests/test_headlines.py`: build `final["headlines"]` from the cases in `web/tests/fixtures/headline_cases.json` (read as `test_hero_text.py` reads `miss_words_cases.json`) and compare `case`, `hero_h1`, `verdict_h2`, `vs_search`, `scoreboard`; also assert the margin comes from `goal.goal()["margin_runs"]` and the h1 never claims more than the figures (FR-003, SC-006)
- [X] T005 Fill `web/tests/fixtures/headline_cases.json` with the ten cases listed in `contracts/api.md` (beat by at least the margin, by exactly the margin, by less, level, worse, no language model, within 0.5 runs, search ahead, one try, pick differs from agent), each with `inputs` and `expected`, using the wording in `research.md` R7 and `design/README.md` "The headline"
- [X] T006 [P] Write `tests/test_agent_model.py`: `final["agent_model"]` has `source`, `features`, `coefficients`, `intercept`; equals the refit used to score the agent; `source == "search"` with no language model; every number in `final.accuracy`, `final.test_mae`, `final.validation_mae` and the top-level `coefficients` is unchanged (compare against values asserted in `tests/test_final_test.py`)
- [X] T007 [P] Write `tests/test_structure_rows.py`: `check_rows` raises on a node with no row, an unknown row, and a mapping key that is not a node (modelled on `tests/test_stages.py`); `/api/structure` sends `nodes[].row` and ordered `rows` with the "up to {ROUND_CAP} rounds" note built from `state.ROUND_CAP`; all twelve nodes map as in `plan.md` Design 3
- [X] T008 [P] Extend `tests/test_api_models.py`: `/api/models` has `run.per_hour` and `run.deadline_seconds` equal to the gate's settings, and still no model ids
- [X] T009 Add `agent_verdict()` to `backend/linreg/goal.py` (same `compare` and `MARGIN_RUNS` as `verdict`)
- [X] T010 Create `backend/linreg/headlines.py` with `case_for`, `hero_h1`, `verdict_h2`, `vs_search`, `scoreboard` and `build`, from the displayed agent, search and TV test misses, `rounds_used` and whether a language-model setup was fitted (tries count rejected proposals; "0 numbers made up by the AI" is code-only copy)
- [X] T011 Update `backend/linreg/scoring.py` `final_scoring` to also return `agent_verdict` (null with no language model)
- [X] T012 Update `backend/linreg/nodes.py` `final_test` to add `final["agent_model"]` (from `scores["llm"]["fitted"]`, else the search's, rounded as the winner's fields), `final["agent_verdict"]` and `final["headlines"]`; change no score and no top-level winner field
- [X] T013 Add `NODE_ROWS` and `ROW_DEFS` to `backend/linreg/graph.py` and `check_rows(app, mapping, rows)` to `backend/linreg/stages.py`
- [X] T014 Update `backend/linreg/stage_info.py` `structure_extras` to add the ordered `rows` (title and note; round note from `state.ROUND_CAP`), and `api/index.py` to put `row` in each node's `node_meta`
- [X] T015 Add `limits()` to `backend/linreg/run_gate.py` (same `_number` reads the gate enforces) and make `api/index.py` return `run` beside `models` from `/api/models`
- [X] T016 Extend `tests/test_final_test.py`, `tests/test_structure_stages.py`, `tests/test_goal_one_source.py` and `tests/test_methods_goal.py` for the new fields, `row`s and the single margin; run `uv run pytest` until green and `tests/test_no_test_year_leak.py` still passes

**Recorded run (plan Phase 2)**

- [X] T017 [P] Create `backend/linreg/fingerprint.py` with `data_fingerprint()` (SHA-256 over `data/manifest.json` and the sizes of `data/innings.csv` and `data/overs.csv`)
- [X] T018 Create `scripts/record_run.py` (beside `scripts/time_models.py`): stream the graph with the same `run_events` the API uses, add `recorded_on`, `model_name`, `fingerprint`, `done`, refuse a run without `final.headlines`; support `--fake --out PATH`
- [X] T019 Write `tests/test_recorded_run.py`: the stored fingerprint equals `data_fingerprint()` and the stored `final_test` headlines equal `headlines.build` of the inputs taken from the state folded up to and including the `final_test` step (`rounds_used` comes from earlier steps) (FR-019, SC-009); add `test_shipped_run_is_real` (pytest mark `release`, deselected by default through `addopts = -m "not release"` in `pyproject.toml`, run in T083) which fails while `web/public/recorded-run.json` has the fake model's `model_name`; and `tests/test_fake_recording.py`: regenerating the fake recording in memory equals `web/tests/fixtures/recorded-run.fake.json` (date and model name excluded)
- [X] T020 Generate `web/tests/fixtures/recorded-run.fake.json` with `uv run python scripts/record_run.py --fake --out web/tests/fixtures/recorded-run.fake.json`; copy it to `web/public/recorded-run.json` as a stand-in until the owner records the real run (T021); the stand-in must not be released (`test_shipped_run_is_real` in T019 fails until T021 is done)
- [ ] T021 **Owner step, release blocker**: after T016 is merged, run `OPENROUTER_API_KEY=… uv run python scripts/record_run.py` to write the real `web/public/recorded-run.json`; check its gzipped size; re-run whenever the data is rebuilt or the headline wording changes
- [X] T022 Add a cache header for `/recorded-run.json` (`public, s-maxage=3600, stale-while-revalidate=86400`) in `vercel.json`

**Shared front-end pieces (plan Phase 3)**

- [X] T023 [P] Write `web/tests/unit/detail-level.test.ts`: `?view=everything` wins and is stored; storage that throws falls back to memory; `setLevel` sets `body.dataset.view` and fires `viewchange`; the choice is read back on the other page
- [X] T024 Create `web/src/detail-level/detail-level.ts` (key `linreg:view`, try/catch storage, `?view`, `body[data-view]`, `viewchange`)
- [X] T025 [P] Write `web/tests/unit/rows.test.ts`: `rows.ts` groups nodes into the server's rows in server order, keeps node order, ignores `__start__`/`__end__`, and lists nodes in order when a structure has no `rows`
- [X] T026 Create `web/src/graph-replay/rows.ts` (pure grouping from the structure)
- [X] T027 Create `web/src/graph-replay/rows-view.ts` (HTML flex rows, stage badge in the stage colour, mono node name, dashed purple outline and "AI" tag for `actor: "llm"`, 3 px ring on the active node, row title and note from the structure, the `items` "done beforehand" pill in the first row) and rewrite `web/src/graph-replay/styles.ts` row styles
- [X] T028 Update `web/src/graph-replay/graph-replay.ts` to draw rows with `rows-view.ts`; add `loadRun(events)`, `play()`, `pause()`, `restart()`, the `view="structure"` mode (no run controls or panels) and `receivedState` in the `replaychange` detail; keep `buffer.ts`, `sse.ts`, `stages.ts`, `state-view.ts`, `legend.ts` (extend `buffer.ts` with a pure state fold only if none is exported) and update `web/tests/unit/buffer.test.ts` for `loadRun` and the fold
- [X] T029 Delete `web/src/graph-replay/layout.ts`, `bands.ts`, `svg.ts` and `web/tests/unit/layout.test.ts`, `bands.test.ts`; remove `@dagrejs/dagre` from `web/package.json` and refresh `web/package-lock.json` with `npm uninstall @dagrejs/dagre`; update `web/src/graph-replay/README.md`
- [X] T030 (with the no-app-words unit test `web/tests/unit/graph-replay-generic.test.ts`; the harness page `web/tests/fixtures/reuse-graph.html` carries the other-app specs) Rewrite `web/tests/e2e/structure.spec.ts`, `stages.spec.ts` and `reuse.spec.ts` for rows (they stay on the `testIgnore` list from T035 until T050 mounts the graph on the page, then T052 re-enables them; keep legend, badge, highlight and "another app's stages" intents; drop band and edge assertions; give `web/tests/fixtures/other-structure.json` and `linreg-structure.json` a `rows` list); add `web/tests/e2e/graph-rows.spec.ts` (four rows in server order, nodes in the rows the server sent, AI tag, active ring) and a unit test that greps `web/src/graph-replay/` for cricket and regression words (none allowed)
- [X] T031 [P] Create `web/src/page/run-source.ts` and `web/tests/unit/run-source.test.ts`: stays recorded until a live stream has received `final_test`; then switches; failed or refused live runs keep or restore recorded; reload resets (research R9, R10)
- [X] T032 [P] Create `web/src/page/recorded.ts` (load `/recorded-run.json`, check shape, fold events to the final state) and `web/tests/unit/recorded.test.ts` (fold equals the buffer's final state for `web/tests/fixtures/recorded-run.fake.json`; a missing or malformed file reports unavailable)
- [X] T033 Create `web/src/detail-level/site-header.ts` and the Commentary and header CSS in `web/src/page/commentary.css` and `web/src/page/simple.css`: breadcrumb, `view-switch` (`aria-pressed`, label "Show me everything"/"Simple view", 44 px pill), page link, Feedback; below 560 px app-name breadcrumb and 44 px icon buttons with full `aria-label`s (Feedback keeps its current name); Commentary panel (dashed, COMMENTARY label, dark variant) shown by `body[data-view="everything"]` or `data-open`; toggles keep `aria-expanded` in step on `viewchange`; existing tokens only
- [X] T034 Rewrite `web/index.html` as the one-page skeleton in `specs/020-simpler-pages/contracts/page-contract.md` (header, `<main>` with empty `#hero`, `#problem`, `#watch`, `#verdict`, `#try`, `#scorebook`, footer; tab bar and old panels removed) and replace `web/src/page/main.ts` with a loader that imports the detail level, header, recorded file and run source; keep the page building (`npm run build`)
- [X] T035 Update `web/tests/e2e/helpers.ts` (replace `open`, `finishRun`, `openTab` with `open`, `showEverything`, `watchToEnd`, `openScorebook(card)`), delete `web/tests/e2e/tabs.spec.ts`, and add a `testIgnore` list to `web/playwright.config.ts` naming every spec that still targets the old tabbed page or needs the graph on the page: `hero`, `play`, `navigate`, `found`, `final`, `tryit`, `explanation`, `reference`, `panels`, `llm-run`, `cricket-terms`, `data-tab`, `under-the-hood`, `structure`, `stages`, `reuse`, `graph-rows`; each rewrite task removes its spec from the list, and T083 fails if the list is not empty

**Checkpoint**: `uv run pytest`, Vitest, `npm run build` and the enabled Playwright specs pass; the page shows the new header and an empty skeleton; both pages' switch works. Only the backend is shippable at this point; the main page is a skeleton until US1 and US2.

---

## Phase 3: User Story 1 - Understand the result in seconds (P1) 🎯 MVP

**Goal**: the hero states the result, with the Scoreboard card, from page load.
**Independent test**: load the page; check the hero text, card figures, order and first screen at 390 × 664.

- [X] T036 [P] [US1] Write `web/tests/unit/scoreboard.test.ts`: `scoreboard.ts` shows `final.headlines` words unchanged, formats the two averages, uses "Brute-force search" and drops "tries" and "0 numbers made up by the AI" for `no_llm`, and shows the agent's figures when the search was the pick (reads `headline_cases.json`)
- [X] T037 [P] [US1] Write `web/tests/e2e/hero.spec.ts` (rewrite, then take it off the `testIgnore` list): kicker, backend h1, lead, links "Watch it work" and "Try your own innings", card kicker with test year and innings, both averages, the three facts, the "From a recorded run on {date} with {model}" line, dark Commentary closed by default with the TV, goal and who-does-what content from `/api/reference`, and the footer ending "Questions or ideas? Leave feedback" with the credit line
- [X] T038 [P] [US1] Write `web/tests/e2e/first-screen.spec.ts` at 390 × 664: order kicker, h1, card, lead, links; h1 and both averages inside the first screen; header on one row (FR-020, SC-001)
- [X] T039 [US1] Create `web/src/page/scoreboard.ts` (pure card view from `final.headlines` and `final.accuracy`)
- [X] T040 [US1] Rewrite `web/src/page/hero.ts` for the new hero (kicker, h1, lead, links, card, origin line, dark Commentary from `/api/reference` and `goal`); show recorded figures from page load; leave the existing worm chart where it is for now (T060 moves it into the problem section's Commentary)
- [X] T041 [US1] Add the hero markup and styles to `web/index.html` and `web/src/page/simple.css`; hero order on a phone is kicker, h1, card, lead, links
- [X] T042 [US1] Show the "recorded run missing" message and the "Run it live" offer when `recorded.ts` reports unavailable (spec edge case)

**Checkpoint**: US1 passes alone.

---

## Phase 4: User Story 2 - Watch the agent think without pressing anything (P1)

**Goal**: the recorded run plays by itself, can be paused, replayed or swapped for a live run.
**Independent test**: scroll to `#watch`; rounds appear with no press; no run request.

- [X] T043 [P] [US2] Write `web/tests/unit/player-state.test.ts`: labels and actions for "▶ Watch the recorded run", "❚❚ Pause", "▶ Watch again", "▶ Watch your run again", and the toolbar label "Recorded {date} · {model}" / "Your live run · {model}"
- [X] T044 [P] [US2] Write `web/tests/unit/round-feed.test.ts`: a round becomes `{round, idea, reason, score, status}` with the five statuses, the idea in plain words (clue added, or full list for a fresh start, plus seasons choice), the reason unchanged
- [X] T045 [P] [US2] Write `web/tests/e2e/watch.spec.ts`: autoplay when `#watch` first scrolls into view; Pause by mouse, touch and keyboard; "Watch again" at the end; reduced motion shows the finished run; replay makes no `/api/run` request; loop strip pills; round rows; "Show the full agent graph" opens the four-row graph with the state card and stage legend (Back, Step, Reset, Speed only inside it); phone stacking
- [X] T046 [P] [US2] Write `web/tests/e2e/live-region.spec.ts`: one short polite line per new round; nothing on Back or jump (FR-018, SC-010)
- [X] T047 [P] [US2] Write `web/tests/e2e/live-panel.spec.ts` with the fake models: panel closed by default, opens under the toolbar and with Show me everything; labelled Language model select from `/api/models` (default marked and first, names only, `aria-describedby` note); note with run length and hourly limit from `run`; "Start live run"; hero and verdict keep recorded figures until the live final test arrives, then switch, the card line reads "From your live run with {model}." and the toolbar reads "Your live run · {model}"; gate refusal (route a 429) shown in the panel with the recorded run unchanged; a mid-run error restores the recorded run
- [X] T048 [US2] Create `web/src/page/player-state.ts` and `web/src/page/round-feed.ts` (reasoning text carries `data-reasoning`)
- [X] T049 [US2] Create `web/src/page/watch.ts`: toolbar, loop strip, round feed, visually hidden `role="status"` live region (one line per new round), `IntersectionObserver` autoplay with a first-interaction fallback, reduced-motion jump to the end, footer "Best idea: …" and the graph toggle; feed the recorded events through `GraphReplay.loadRun`
- [X] T050 [US2] Add the Watch it think markup (kicker, h2, loop strip, player card, graph panel holding `<graph-replay>`, Commentary above the player with "What the agent decides" and "How each idea is scored" from the catalogue and data years) to `web/index.html` and the styles to `web/src/page/simple.css`
- [X] T051 [US2] Create `web/src/page/live-panel.ts` and update `web/src/page/models.ts` (default marked "(default)" and first, names only, note linked by `aria-describedby`, `run` limits); wire "Run it live with your choice of AI" (`aria-expanded`) and "Start live run" to `GraphReplay`'s stream; show the gate's message in the panel; wire the `RunSource` switch on `receivedState.final` and the restore on failure
- [X] T052 [US2] (all rewritten; `llm-run` now drives the live-run panel)  Remove `structure`, `stages`, `reuse` and `graph-rows` from the `testIgnore` list now that T050 mounts the graph, and rewrite `web/tests/e2e/play.spec.ts` and `navigate.spec.ts` for the graph Commentary controls and the recorded source; update `llm-run.spec.ts` and `panels.spec.ts` selectors (open the graph Commentary first); take `play`, `navigate`, `llm-run` and `panels` off the `testIgnore` list
- [X] T053 [US2] Delete `web/src/page/readiness.ts`, `web/src/page/summary.ts` and their Vitest files (`readiness.test.ts`, `summary.test.ts`) once nothing imports them

**Checkpoint**: US1 and US2 work together; the page plays the recorded run and a live run replaces it on its final test.

---

## Phase 5: User Story 3 - Reveal everything at once, and share that view (P2)

**Goal**: the switch opens every Commentary panel on both pages; the choice persists; links can open it.
**Independent test**: press the switch, reload, change page; load `?view=everything`.

- [X] T054 [P] [US3] Write `web/tests/e2e/detail-level.spec.ts`: header items on one row at 390 px; pressed state and label swap; all Commentary opens and closes; choice survives reload and the move to `/under-the-hood.html`; storage blocked still works for the current view; `?view=everything` opens it; opening a panel does not move the reader; the Scorebook stays closed
- [X] T055 [US3] Give every Commentary panel on the main page `class="commentary"` and its toggle `aria-controls`/`aria-expanded` (hero, problem, Watch it think including "What the agent decides" and "How each idea is scored", the live-run panel, verdict, graph, trust) and verify the global switch opens them all; fix any panel that opens above its toggle
- [X] T056 [US3] Make `?view=everything` and the stored choice apply before first paint on both pages (no flash of simple view) in `web/src/detail-level/detail-level.ts`

**Checkpoint**: US3 passes on the main page; the built page joins in T071 and T072.

---

## Phase 6: User Story 4 - Read the verdict and try my own innings (P2)

**Goal**: the verdict judges the agent; "Your turn" predicts with the agent's own model.
**Independent test**: check headline, bars, labels and form against the recorded run.

- [X] T057 [P] [US4] Write `web/tests/e2e/verdict.spec.ts` (rewrite of `final.spec.ts`, then take `final` off the `testIgnore` list): backend h2 and agent-vs-search sentence (too close to call within 0.5 runs), four bars in order with caption, rule-of-thumb card labelled "from the best model on the check seasons", trust toggle with three bullets (opens alone and with Show me everything), three Commentary cards, the pick and its goal verdict only in "Check seasons vs the final test", agent bar reads "not run" with no language model
- [X] T058 [P] [US4] Update `web/tests/e2e/tryit.spec.ts` (and take it off the `testIgnore` list) and `web/tests/unit/predict.test.ts`: inputs follow `final.agent_model`; label says "the agent's model" or "the brute-force search's model"; Predict shows that model beside the TV
- [X] T059 [US4] Create `web/src/page/verdict.ts` and `web/src/page/verdict-bars.ts` (h2, sentence, bars, rule-of-thumb card, trust toggle, three Commentary cards reusing `web/src/page/final/closeness.ts`, `differ.ts`, `takeaways.ts`; "What moves the final total" labelled "from the best model on the check seasons")
- [X] T060 [US4] Create `web/src/page/problem.ts` (h2 from the reference figures, the three example-innings tiles with caption, worm chart and its zoom in Commentary using `worm.ts` and `worm-layout.ts`) and add The problem, The verdict and Your turn markup to `web/index.html`
- [X] T061 [US4] Change `web/src/page/tryit.ts` to build the model from `final.agent_model` (fall back per `source`), add the model label (`tryit-model-label`), and restyle the form as the dark "Your turn" card in `web/src/page/simple.css`
- [X] T062 [US4] Update `web/tests/e2e/explanation.spec.ts`, `reference.spec.ts` and `cricket-terms.spec.ts` for the new layout and wording and take them off the `testIgnore` list; delete `web/src/page/final/index.ts`, `pick.ts`, `race.ts` and `web/tests/unit/final-race.test.ts` once nothing imports them

**Checkpoint**: US4 passes; the main page tells the whole story in simple view.

---

## Phase 7: User Story 5 - Dig into the full detail on demand (P3)

**Goal**: every earlier detail is reachable from the Scorebook and the old links.
**Independent test**: open each card; follow each old link.

- [X] T063 [P] [US5] Write `web/tests/unit/anchors.test.ts` for the old-link map in `data-model.md` and `web/tests/e2e/anchors.spec.ts` (all five old links land; `#data` opens the data panel)
- [X] T064 [P] [US5] Write `web/tests/e2e/scorebook.spec.ts`: four cards; one panel at a time, full width below the cards; close returns focus to its card; `/api/data` fetched only on first open of the data panel; ranked list and both brute-force grids match today's content; data grid summary, filters and CSV download work; the graph card opens and scrolls to the full graph; the last card links to `/under-the-hood.html`; every panel renders with `/api/run` blocked (FR-022, SC-011, SC-008)
- [X] T065 [US5] Create `web/src/page/anchors.ts` and call it on load and on `hashchange`
- [X] T066 [US5] Create `web/src/page/scorebook.ts` mounting `web/src/page/found/ranking.ts`, `found/grid.ts` and `data-tab.ts` with `<data-grid>`; add the Scorebook markup to `web/index.html` and the main page footer ("Built by John Fong · Tested by Alesja Tanabe · Ball-by-ball data from Cricsheet · Questions or ideas? Leave feedback")
- [X] T067 [US5] Rewrite `web/tests/e2e/found.spec.ts` as Scorebook models checks, re-point the grid tests in `web/tests/e2e/data-tab.spec.ts` at the Scorebook data panel; move its tab-set tests to `web/tests/e2e/reuse-data.spec.ts`, and take `found` and `data-tab` off the `testIgnore` list; keep `tab-set` in the repo but off the main page
- [X] T068 [US5] Delete `web/src/page/found/index.ts`, `contest.ts`, `seasons.ts`, `race.ts`, `race-layout.ts`, `rounds.ts` and `web/tests/unit/found-race.test.ts` once `tsc --noEmit` and a grep show no importer

**Checkpoint**: US5 passes; no earlier detail is lost.

---

## Phase 8: User Story 6 - Understand how the app was built, simply (P2)

**Goal**: the built page uses the same levels, header and graph.
**Independent test**: check the hero facts, parts, Commentary state and graph on `/under-the-hood.html`.

- [X] T069 [P] [US6] Rewrite `web/tests/unit/under-the-hood-figures.test.ts` and `under-the-hood-panels.test.ts` for the four facts (agent steps and language-model steps from `/api/structure`, clues from the catalogue, innings from the manifest figures) and the Commentary panels
- [X] T070 [P] [US6] Update `web/tests/e2e/under-the-hood.spec.ts` (and take it off the `testIgnore` list): header and switch match the main page, "← Back to the app" to `/`; hero h1, lead, four counted facts (`fact-steps`, `fact-llm-steps`, `fact-clues`, `fact-innings`) and jump links; the footer ends "Questions or ideas? Leave feedback" (FR-011); each part has heading and visual with Commentary closed; exclusion table, API table (own scroll box on a phone) and gate limits in Commentary; Part 3 uses the shared four-row graph (`view="structure"`) and stage legend; "The question" gone; feature 019 "Who built this" section, links and accessible names unchanged
- [X] T071 [US6] Rewrite `web/under-the-hood.html` to the structure in `design/README.md` "How this app was built page" (hero, big picture, 1 · The data, 2 · Pressing Play, 3 · Inside the agent, 4 · What you see, 5 · Shipping it, Who built this untouched), with Commentary panels, the new header and a footer that ends "Questions or ideas? Leave feedback" linking to the same page as Feedback
- [X] T072 [US6] Update `web/src/page/under-the-hood/main.ts`, `figures.ts`, `panels.ts`, `dom.ts` and `under-the-hood.css`: import the detail level and header, count the facts from the API (not typed), mount `<graph-replay view="structure">`, keep the gate limits read from `/api/models` `run`
- [X] T073 [US6] Cut each stage card on the built page to two or three sentences, keeping every number read from the API

**Checkpoint**: US6 passes; both pages share one look and one switch.

---

## Phase 9: User Story 7 - Share the page on LinkedIn (P3)

**Goal**: the posted link shows a title and description that match the hero.
**Independent test**: fetch the raw HTML with no script and read the tags.

- [X] T074 [P] [US7] Write `web/tests/e2e/preview-tags.spec.ts`: fetch `/` as raw HTML (no script) and assert `<title>`, `description`, `og:title`, `og:description`, `og:url` (absolute `https://`), `og:type`, `twitter:card`, no `og:image`, and that wording matches the `beat` hero
- [X] T075 [US7] Add the fixed preview tags to `web/index.html` (worded for the `beat` case, independent of any run); put `og:url` in one constant for the owner to set
- [ ] T076 [US7] **Owner step**: set the production address in `og:url` and confirm

**Checkpoint**: US7 passes.

---

## Phase 10: Polish and cross-cutting checks

- [X] T077 [P] Write `web/tests/e2e/word-count.spec.ts`: visible `innerText` of `<main>` on the recorded run's finished state, Scorebook closed, text inside `[data-reasoning]` removed; main page ≤ 500 words simple and ≤ 1,200 with Show me everything, built page ≤ 500 and ≤ 1,200 (FR-015, SC-002); trim copy until it passes; also assert that simple-view `<main>` (outside Commentary and `[data-reasoning]`) contains none of: "features", "validation", "candidate model", "forward selection", "know-nothing" (FR-002 plain words)
- [X] T078 [P] Write `web/tests/e2e/phone.spec.ts`: both pages at 390 px have no horizontal scroll, every interactive target at least 44 px, header icons below 560 px with full accessible names and Feedback's name unchanged, tables scroll inside their own box (FR-014, SC-007)
- [X] T079 [P] Write `web/tests/e2e/contrast.spec.ts`: 4.5:1 for new text, panels, the dark hero and card, graph pills and the Commentary label, in light and dark, on both pages
- [X] T080 [P] Write `web/tests/e2e/recorded-run.spec.ts`: with `**/api/run*` aborted, every section and every Scorebook panel renders, and the only API calls are `/api/structure`, `/api/reference`, `/api/catalogue`, `/api/models` and (on first open) `/api/data` (FR-022, SC-011, SC-005)
- [X] T081 Delete anything left unused (modules, CSS, fixtures, test ids) after `tsc --noEmit` and a grep; confirm `web/src/tab-set/` and its tests remain
- [X] T082a Bring `specs/020-simpler-pages/design/README.md` into line with the spec: header at phone width (icon buttons below 560 px), hero facts (clues, not API routes), rule-of-thumb and "What moves the final total" labels, "Your turn" using the agent's model, toolbar label after a live run, live switching on the final test, tries counting rejected proposals, the live region, the 390×664 hero order, the recorded-run fingerprint, fixed preview copy, headlines judging the agent with the pick only in Commentary
- [X] T082 Update `README.md` (the one-page layout, detail levels, recorded run and `scripts/record_run.py`, header at phone width) and `web/src/graph-replay/README.md`
- [X] T083 (done; `pytest -m release` fails on purpose until the owner steps T021 and T076 are done) Run the full suite: `uv run pytest` and `uv run pytest -m release` (needs the real recording from T021), `cd web && npm test && npm run build && npm run e2e`, with the `testIgnore` list in `web/playwright.config.ts` empty; fix failures; walk through `specs/020-simpler-pages/quickstart.md`
- [X] T084 Update `specs/020-simpler-pages/checklists/requirements.md` notes with the result and mark the spec status "Implemented" in `specs/020-simpler-pages/spec.md`

---

## Dependencies and order

- **Phase 1** then **Phase 2** (blocks everything). Within Phase 2: T004 to T016 (backend) before T017 to T022 (recording needs the headlines); T023 to T035 (front end) can start after T016 for the pieces that read `rows` and `final.*`, and T023 to T025, T031 and T032 need nothing from the backend.
- **US1** (Phase 3) needs T034 and T020 (or T021). **US2** (Phase 4) needs T028, T031, T032 and US1's page. **US3** needs T033 and the Commentary markup from US1, US2, US4. **US4** needs T012 and the recorded file. **US5** needs T034 and the Phase 2 recording. **US6** needs T028, T033 and T015. **US7** needs only T034.
- The owner's real recording (T021) is not a blocker for any test, which use the fake fixture, but is needed before release; re-record after any change to `headlines.py`.
- Polish (Phase 10) runs last; T077 may need copy trimmed in earlier phases.

## Parallel examples

- Phase 2 tests in parallel: T004, T006, T007, T008, T023, T025.
- After the Phase 2 checkpoint: the US1 tests (T036 to T038), US2 tests (T043 to T047) and US4 tests (T057, T058) in parallel, since they are different files. The markup tasks (T041, T050, T060, T066) all edit `web/index.html` and `web/src/page/simple.css`, so do those in order.
- Polish tests T077 to T080 in parallel.

## Implementation strategy

- **MVP**: Phase 1, Phase 2 and US1 (the hero with the Scoreboard card on the recorded run) is already a shippable first screen for LinkedIn visitors. Add US2 next (the centrepiece), then US4, US3, US6, US5, US7.
- Each phase leaves every enabled test green; specs on the `testIgnore` list (T035) come back as their rewrite tasks land. Delete old modules only after a grep and `tsc --noEmit` show no importer. Record the real run (T021) after the backend merges and again after any wording change.

## Task counts

Total 85. Setup 3, Foundational 32 (T004 to T035), US1 7, US2 11, US3 3, US4 6, US5 6, US6 5, US7 3, Polish 9 (T077 to T084, plus T082a).
