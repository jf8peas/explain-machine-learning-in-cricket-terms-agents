# Implementation Plan: Simpler Pages

**Branch**: `020-simpler-pages` (work is on `main`; no branch hook ran) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)
**Input**: The specification, [design/README.md](design/README.md) (source of copy and structure), and the planning brief. Decisions and their reasons are in [research.md](research.md).

## Summary

Turn the five-tab main page into one scrolling page led by the agent: a hero with a Scoreboard card, a recorded run that plays by itself, a verdict, a "Your turn" form and a Scorebook, with every detail behind "Show me everything" or its own toggle. Restructure "How this app was built" the same way. The backend gains the words (headlines), the agent's own final model and a row for each graph node; a recorded run ships as a static file; the graph is redrawn in four rows by one shared component; one shared module owns the detail level. No new runtime dependency (dagre is removed).

## Technical Context

**Language/Version**: Python 3.12 (FastAPI, LangGraph, NumPy); TypeScript 5 (Vite 5, no framework, custom elements)
**Primary Dependencies**: none new. `@dagrejs/dagre` is no longer imported and is removed
**Storage**: none new on the server; `localStorage["linreg:view"]` in the browser (best effort); one static file, `web/public/recorded-run.json`
**Testing**: pytest (`apps/linear_regression/tests`), Vitest (`web/tests/unit`), Playwright (`web/tests/e2e`, fake language model)
**Target Platform**: evergreen browsers, light and dark themes, 390 × 664 px phones (LinkedIn's in-app browser) up to desktop; Vercel (static files plus one Python function)
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: first screen shows the headline and both averages with no scrolling; replaying the recorded run makes no run request
**Constraints**: scoring, nodes, edges and prompts unchanged; every figure and data-dependent sentence from the API or the recorded file; 44 px targets; 4.5:1 contrast; no horizontal scroll at 390 px; no cricket or regression words in the graph component; word budgets in FR-015
**Scale/Scope**: about 12 new and 25 changed source files, 15 deleted; about 14 new test files and 15 rewritten

## Constitution Check

No constitution exists, so there are no gates. Principles carried from earlier features:

- **One source for each fact**: one goal definition (`MARGIN_RUNS` through `compare`) for pick and agent; one place for the headline words (`headlines.py`); one detail-level module; one graph component for both pages.
- **No new dependency or route**: dagre is removed; the only API changes are fields on existing responses.
- **The test year stays sealed**: `headlines` and `agent_model` are built inside `final_test`, the only step that reads the test slice (`test_no_test_year_leak` stays green).

**Re-check after design**: no violations.

## Project Structure

### Documentation

```text
specs/020-simpler-pages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md                   # structure rows, models limits, final.* additions, recorded-run file, headline fixture
│   └── page-contract.md         # sections, test ids, detail-level attribute, header, player
├── checklists/requirements.md
├── design/                      # README.md is authoritative; canvas files are visual references
└── tasks.md                     # created later by /speckit-tasks
```

### Source changes (in `apps/linear_regression/`)

**Backend (`backend/linreg/`)**

| File | Change |
|---|---|
| `headlines.py` | **New.** `case_for(...)`, `hero_h1`, `verdict_h2`, `vs_search`, `scoreboard`, `build(final_inputs)`; no wording elsewhere |
| `goal.py` | **Changed.** add `agent_verdict()` (same `compare`/`MARGIN_RUNS` as `verdict`) |
| `scoring.py` | **Changed.** `final_scoring` also returns `agent_verdict` (null with no language model) |
| `nodes.py` | **Changed.** `final_test` adds `final["agent_model"]`, `final["agent_verdict"]`, `final["headlines"]`; no change to any score or to the top-level winner fields |
| `graph.py` | **Changed.** add `NODE_ROWS`, `ROW_DEFS` |
| `stages.py` | **Changed.** add `check_rows(app, mapping, rows)` beside `check_stages` |
| `stage_info.py` | **Changed.** `structure_extras` adds `rows` (ordered, notes built from `state.ROUND_CAP`) |
| `fingerprint.py` | **New.** `data_fingerprint()` over `data/manifest.json` and data file sizes |
| `run_gate.py` | **Changed.** add `limits()` returning `{per_hour, deadline_seconds}` from the same reads the gate enforces |
| `model_options.py` | **Unchanged** (`public()` stays; `api/index.py` adds `run`) |
| `api/index.py` | **Changed.** `node_meta` gains `row`; `/api/models` adds `run` |
| `scripts/record_run.py` | **New.** runs the graph, writes `web/public/recorded-run.json`; `--fake --out` for tests |
| `vercel.json` | **Changed.** cache header for `/recorded-run.json` |

**Front end (`web/`)**

| Path | Change |
|---|---|
| `index.html` | **Rewritten.** one scrolling page (sections in [page-contract.md](contracts/page-contract.md)), preview tags, the new header; tabs, tab bar and old panels removed |
| `under-the-hood.html` | **Changed.** new header, hero with four facts, Scoreboard + Commentary per part, graph in `view="structure"`; "The question" removed; "Who built this" untouched |
| `public/recorded-run.json` | **New** (recorded by the owner in Phase 2) |
| `src/detail-level/detail-level.ts` | **New.** level, storage, `?view`, `body[data-view]`, `viewchange` |
| `src/detail-level/site-header.ts` | **New.** header wiring: switch, responsive labels, shared by both pages |
| `src/page/commentary.css`, `src/page/simple.css` | **New.** Commentary panel, header, hero card, player, bars, Scorebook styles on existing tokens (no new colour tokens) |
| `src/page/theme.css` | **Changed.** only if a token is missing (none expected) |
| `src/graph-replay/rows.ts` | **New.** pure: group nodes into rows from the structure |
| `src/graph-replay/rows-view.ts` | **New.** HTML pills, stage badges, AI tag, active ring |
| `src/graph-replay/graph-replay.ts` | **Changed.** draw rows; `loadRun(events)`, `play()`, `pause()`, `restart()`; `view="structure"`; `receivedState` in the change detail |
| `src/graph-replay/styles.ts`, `legend.ts`, `README.md` | **Changed.** row styles; legend beside/below; docs |
| `src/graph-replay/layout.ts`, `bands.ts`, `svg.ts` | **Deleted** |
| `src/graph-replay/buffer.ts`, `sse.ts`, `stages.ts`, `state-view.ts` | **Kept** (buffer gains a pure state fold if one is not exported) |
| `src/page/main.ts` | **Rewritten.** orchestrates sections, `RunSource` |
| `src/page/run-source.ts` | **New.** recorded/live source and switching rules |
| `src/page/recorded.ts` | **New.** load and validate the recorded file |
| `src/page/hero.ts` | **Rewritten.** hero text, Scoreboard card, dark Commentary |
| `src/page/scoreboard.ts` | **New.** pure card view from `headlines` + `accuracy` |
| `src/page/problem.ts` | **New.** three tiles; worm chart in Commentary (`worm.ts`, `worm-layout.ts` kept) |
| `src/page/watch.ts`, `player-state.ts`, `round-feed.ts` | **New.** player card, labels, round rows, live region, autoplay on view, reduced motion |
| `src/page/live-panel.ts` | **New.** live-run panel; reuses `models.ts` logic |
| `src/page/models.ts` | **Changed.** default marked and first, names only, `run` limits |
| `src/page/verdict.ts`, `verdict-bars.ts` | **New.** h2, sentence, four bars, rule-of-thumb card, trust toggle, three Commentary cards (reusing `final/closeness.ts`, `differ.ts`, `takeaways.ts`) |
| `src/page/tryit.ts`, `predict.ts` | **Changed / kept.** model from `final.agent_model`, labelled; `predict.ts` unchanged |
| `src/page/scorebook.ts` | **New.** four cards, one panel at a time, focus return; mounts `found/ranking.ts`, `found/grid.ts`, `data-tab.ts` + `<data-grid>` |
| `src/page/anchors.ts` | **New.** old links |
| `src/page/readiness.ts`, `summary.ts` | **Deleted** (tab readiness and the run summary go with the tabs) |
| `src/page/found/{index,contest,seasons,race,race-layout,rounds}.ts` | **Deleted** once no importer remains; `ranking.ts`, `grid.ts`, `view.ts` kept |
| `src/page/final/{index,pick,race}.ts` | **Deleted** once no importer remains; `closeness.ts`, `copy.ts`, `differ.ts`, `takeaways.ts`, `types.ts`, `view.ts` kept |
| `src/page/under-the-hood/*.ts` | **Changed.** detail level, facts from `/api/structure` and the catalogue, shared graph |
| `src/tab-set/*`, `src/data-grid/*` | **Kept** (tab-set leaves the main page; still has its tests) |
| `package.json`, `package-lock.json` | **Changed.** dagre removed |
| `README.md` | **Changed.** page structure, recorded run, scripts |

### Tests

**Python (`tests/`)**: see Tests below.

## Design

1. **The words** (Phase 1). `final_test` already holds the three test misses and the references. `headlines.build` takes the displayed figures (agent, search, TV, tries, whether a language-model setup was fitted) and returns `case`, `hero_h1`, `verdict_h2`, `vs_search`, `scoreboard`. `goal.agent_verdict` and `goal.verdict` share `compare`, so "reached the goal" has one definition. Hero, Scoreboard card and verdict h2 always read `agent_verdict`; the pick's `verdict` and sentence appear only in the "Check seasons vs the final test" card.
2. **The agent's model** (Phase 1). `final["agent_model"]` is filled from `scores["llm"]["fitted"]` (or the search's, `source: "search"`), rounded as the winner's fields are. Scoring code is not touched; a test pins the old numbers.
3. **Rows** (Phase 1). `NODE_ROWS` maps the twelve nodes to `start` (load_data, split, explore, baseline), `round` (propose_features, check_proposal, fit_model, evaluate), `yardstick` (grid_search), `end` (final_test, explain_in_cricket_terms, write_in_cricket_terms). `/api/structure` sends `row` per node and ordered `rows` with notes; the component draws only what it is sent.
4. **Recorded run** (Phase 2). `record_run.py` streams the graph (the same `run_events` the API uses), adds date, model name and fingerprint, refuses a run without `final.headlines`, and writes the file. `test_recorded_run.py` fails when the data fingerprint or the stored headlines are stale.
5. **Shared front-end pieces** (Phase 3). `detail-level.ts` sets `body[data-view]`; Commentary is shown by CSS from that attribute or its own `data-open`, so it cannot disagree with the switch. `site-header.ts` handles the switch and the 560 px icon header on both pages. The four-row graph replaces the dagre drawing inside the existing `<graph-replay>` (buffer, SSE, stages, state view and legend kept).
6. **One current run** (Phase 4). `run-source.ts` holds the recorded run and, once a live run has received `final_test`, the live one. Hero, verdict, Your turn and Scorebook read it; only the player reads the replay element. `GraphReplay.loadRun(events)` plays the recorded run through the existing buffer; `play/pause/restart` back the player's one button. Autoplay starts when `#watch` first intersects the viewport; with `prefers-reduced-motion: reduce` the run is jumped to its end.
7. **Player** (Phase 4). `player-state.ts` gives the button label and action from `{kind, playing, atEnd}`. `round-feed.ts` turns `state.rounds` and `attempts` into rows (idea in plain words, the quoted reason marked `data-reasoning`, score, one status). A visually hidden polite live region speaks one short line per new round and ignores Back and jump.
8. **Live run** (Phase 5). `live-toggle` opens `live-panel`: the labelled select from `/api/models` (names and notes, default marked and first, note linked by `aria-describedby`), the "runs can differ" note with `run.deadline_seconds` and `run.per_hour`, and "Start live run". A refusal shows the gate's message in the panel and changes nothing else; a mid-run failure calls `loadRun(recorded)`. The toolbar label becomes "Your live run · {model}" when the source switches.
9. **Scorebook and anchors** (Phase 6). Four cards, one full-width panel at a time, close returns focus to the card; `/api/data` is fetched on first open of the data panel. `anchors.ts` maps the old links.
10. **Built page** (Phase 7). Same header and detail level; hero facts counted from `/api/structure` (agent steps, language-model steps), the catalogue (clues) and the manifest (innings); the graph is `<graph-replay view="structure">`; the exclusion table, API table and gate limits sit in Commentary.
11. **Preview tags** (Phase 9). Fixed text in `index.html`, worded for the `beat` case; `og:url` is one constant the owner sets; no `og:image`.

## Tests

### Existing tests

| Test | Action |
|---|---|
| Python: `test_agent_run`, `test_final_test`, `test_grid_search`, `test_no_test_year_leak`, `test_scoring`-style accuracy tests, `test_hero_text`, `test_cricket_*`, `test_prompts`, `test_llm_*`, `test_run_gate`, `test_limit_store` | **Kept**; `test_final_test` gains assertions for the new fields and that old numbers are unchanged |
| `test_structure_stages`, `test_api`, `test_api_models`, `test_goal_one_source`, `test_methods_goal` | **Extended** (rows in structure, `run` in models, headlines read the one margin) |
| Vitest: `buffer`, `sse`, `stages`, `state-view`, `state`, `stage-colours`, `csv`, `table-view`, `predict`, `recipes`, `setup`, `worm*`, `chart-colours`, `exam`, `found-view`, `found-choice`, `final-closeness`, `final-copy`, `final-takeaways` | **Kept** (`buffer.test.ts` extended for `loadRun` and the state fold) |
| Vitest: `layout`, `bands`, `readiness`, `summary`, `found-race`, `final-race` | **Deleted** with their modules |
| Vitest: `under-the-hood-figures`, `under-the-hood-panels` | **Rewritten** for the new facts and panels |
| Playwright: `tabs`, `hero`, `play`, `navigate`, `found`, `final`, `tryit`, `structure`, `stages`, `reuse`, `data-tab` (tabs part) | **Rewritten** against the one-page layout (same intents where they still apply; band and tab assertions dropped) |
| Playwright: `llm-run`, `panels`, `explanation`, `reference`, `cricket-terms`, `under-the-hood` | **Updated** (selectors, graph Commentary opened first, margin and verdict words) |
| Playwright: `reuse-data` (tab-set with an unrelated table) | **Kept**; `data-tab` grid tests re-pointed at the Scorebook data panel |
| `helpers.ts` | **Changed**: `open`, `finishRun`, `openTab` replaced by `open`, `showEverything`, `watchToEnd`, `openScorebook(card)` |

### New tests

| Area | Test (file) | Covers |
|---|---|---|
| Headlines | `tests/test_headlines.py`; `web/tests/unit/headline-cases.test.ts`; shared `web/tests/fixtures/headline_cases.json` | all cases and wording (FR-003, SC-006); page shows words as sent; no-LLM card |
| Agent model | `tests/test_agent_model.py` | fields present; equals the refit; scoring numbers unchanged; `source` for no-LLM |
| Rows | `tests/test_structure_rows.py`; `web/tests/unit/rows.test.ts` | `check_rows` errors (missing, unknown, extra); structure sends `row` and `rows`; grouping |
| Recorded run | `tests/test_recorded_run.py`; `tests/test_fake_recording.py`; `web/tests/e2e/recorded-run.spec.ts` | fingerprint and headlines fresh (FR-019, SC-009); fake fixture regenerates identically; every section and Scorebook panel render with `/api/run` blocked and only listed read-only calls (FR-022, SC-011) |
| Models limits | `tests/test_api_models.py` (extended) | `run` field from settings, no ids |
| Detail level | `web/tests/unit/detail-level.test.ts`; `web/tests/e2e/detail-level.spec.ts` | storage in try/catch, `?view`, `aria-pressed`, label swap, carried to the other page, Scorebook stays closed |
| Run source | `web/tests/unit/run-source.test.ts` | stays recorded until live `final_test` received; switches; failed and refused keep recorded; reload resets |
| Player | `web/tests/unit/player-state.test.ts`; `web/tests/e2e/watch.spec.ts` | labels (Pause, Watch again, Watch your run again); autoplay on first view; Pause works by mouse, touch, keyboard; reduced motion shows the finished run; no run request on replay |
| Live run | `web/tests/e2e/live-panel.spec.ts` | closed by default; opens under toolbar and with Show me everything; labelled select from fake models, default first, `aria-describedby`; limits from settings; "Start live run"; hero keeps recorded figures until live final test, then switches and the card line and toolbar label change; gate refusal shown in the panel; mid-run failure restores recorded |
| Live region | `web/tests/e2e/live-region.spec.ts` | one short line per new round; none on Back/jump (SC-010) |
| First screen | `web/tests/e2e/first-screen.spec.ts` | 390 × 664: order kicker, h1, card, lead, links; h1 and both averages in the first screen (SC-001, FR-020); header one row |
| Phone | `web/tests/e2e/phone.spec.ts` | both pages: no horizontal scroll, 44 px targets, header icons with full accessible names below 560 px, Feedback name unchanged (SC-007) |
| Contrast | `web/tests/e2e/contrast.spec.ts` | 4.5:1 for new text, panels, dark hero, graph pills, in light and dark |
| Word count | `web/tests/e2e/word-count.spec.ts` | visible `innerText` of `<main>` on the recorded run's finished state, Scorebook closed, `[data-reasoning]` excluded: main ≤ 500 / ≤ 1,200 and built page ≤ 500 / ≤ 1,200 (FR-015, SC-002) |
| Anchors | `web/tests/unit/anchors.test.ts`; `web/tests/e2e/anchors.spec.ts` | all five old links land; `#data` opens the data panel |
| Scorebook | `web/tests/e2e/scorebook.spec.ts` | four cards; one panel at a time; focus returns; `/api/data` fetched only on first open; model list, grids, data grid and download content |
| Your turn | `web/tests/e2e/tryit.spec.ts` (updated), `predict.test.ts` | inputs follow the agent's model; label says agent or search; rule of thumb and drivers labelled "from the best model on the check seasons" |
| Graph | `web/tests/e2e/graph-rows.spec.ts`; `reuse.spec.ts` | four rows in server order, nodes in the rows the server sent, AI tag, active ring, phone stacking; another app's rows draw from its own structure; no cricket word in `src/graph-replay` (grep test) |
| Built page | `web/tests/e2e/under-the-hood.spec.ts` (updated) | hero facts counted not typed, parts with Commentary closed, graph shared, "The question" gone, feature 019 section intact |
| Preview tags | `web/tests/e2e/preview-tags.spec.ts` | tags present in raw HTML with no script, `og:url` absolute https, no `og:image` |

## Implementation order

Each phase leaves every enabled test green. Old Playwright specs that cannot pass against the new page are put on a `testIgnore` list in Phase 2 and come back as their rewrites land; only the backend is shippable until the first main-page sections exist (end of Phase 4).

1. **Backend: headlines, agent model, rows.** `headlines.py`, `goal.agent_verdict`, `final_test` additions, `NODE_ROWS` and `check_rows`, structure `rows`, `/api/models` `run`. Exit: new pytest files pass; old numbers unchanged; the current five-tab page still works (it ignores the new fields).
2. **Recorded run.** `fingerprint.py`, `record_run.py`, `test_recorded_run.py`, the fake fixture. The owner records the real run after Phase 1 is merged. Exit: fingerprint and headline checks pass; file size measured (see Risks).
3. **Shared front-end pieces.** `detail-level.ts`, `site-header.ts`, Commentary CSS; the four-row graph replaces the dagre drawing; dagre removed. Exit: both pages show the new header and switch; graph rows render on the old page; deleted Vitest files gone; `reuse.spec` and `stages.spec` rewritten and green.
4. **Main page sections.** One-page `index.html`; hero and Scoreboard card, problem, Watch it think with the player and recorded autoplay, verdict, Your turn from `agent_model`; `RunSource`. Exit: the page renders from the file alone with `/api/run` blocked; first-screen test passes.
5. **Live-run panel.** `live-panel.ts`, `models.ts` changes, switching and failure rules. Exit: `live-panel.spec` and `run-source.test` pass.
6. **Scorebook and anchors.** `scorebook.ts`, `anchors.ts`; old panels' content reachable; tab-set leaves the page. Exit: `scorebook.spec`, `anchors.spec` pass; SC-008 holds.
7. **"How this app was built" page.** Restructure with the shared graph and facts. Exit: updated `under-the-hood.spec` and Vitest pass; feature 019 section unchanged.
8. **Tests and size checks.** Word-count, contrast, phone, live-region and first-screen specs; delete leftover old specs and modules with no importer. Exit: full pytest, Vitest, `npm run build` and Playwright green.
9. **Preview tags.** Fixed copy and `og:url`; `preview-tags.spec`. Exit: green; owner confirms the address.

## Risks and open items

| Risk | Handling |
|---|---|
| The recorded file may be large (the stream carries the grid-search cells) | Measure in Phase 2. Vercel gzips static JSON. The Scorebook grids read the cells, so they stay in the file; if the gzipped size is a problem, load the file in the background after first paint (the hero's figures need only the last events) |
| Autoplay depends on an `IntersectionObserver`; headless tests may not scroll | Tests scroll to `#watch` explicitly; a fallback starts playback on first interaction with the section |
| `<graph-replay>` lives inside a closed Commentary panel | Rows are HTML with no measuring, and the panel is hidden by CSS (not removed), so the buffer and state keep running |
| The deployed address for `og:url` is not in the repo | Owner supplies it in Phase 9; the test only checks it is absolute `https://` |
| The real recording needs the owner's key and takes a real run | Phase 2 splits the script and the recording; tests use the fake fixture |
| Deleting `found/*` and `final/*` modules may break an importer | Delete only after a grep and `tsc --noEmit` show none remain |
| Old e2e specs are large (`stages` 792, `data-tab` 618, `final` 590, `hero` 515 lines) | Rewrite spec by spec within Phases 3 to 6, keeping each intent that still applies |

## Complexity Tracking

No constitution violations to justify.

## Implementation notes (what changed from the plan while building)

- **Rows**: `NODE_ROWS` is in `graph.py` as planned; the ordered row titles and notes live in `stage_info.rows()` (not a `ROW_DEFS` in `graph.py`), so the round note can read `state.ROUND_CAP`. `check_rows` and `Row` are in `stages.py`. The component orders steps within a row by the order a run first reaches them (`rows.ts` `executionOrder`), because `/api/structure` lists nodes in no useful order.
- **The graph's "state card"** is the component's Event panel (step, step number, who, stage, summary) plus a closed "Show every value" details for the raw state; the round, score and best-so-far are in the player's round feed and "Best idea" line, so the component stays free of app words.
- **Word budgets** are measured at 390 px (LinkedIn's in-app browser) on `<main>`, with closed `<details>` counting only their summary and a closed select only its choice. To meet them: "Path taken" and "Show every value" are closed details, "About this chart" and "About this stage" too, the verdict's Commentary shows a compact pair of exam cards, the top four clues and no closeness lead, and a round lists only the settings it changed.
- **`/api/models`** also sends `per_day` (the site's daily limit), for the built page's gate sentence.
- **Plain words**: a rejection reason from the server is shown with "idea", "clues" and "check seasons" in place of "candidate model", "features" and "validation" (`plainWords` in `round-feed.ts`).
- **"Too close to call"**: the server now holds the 0.5-run rule in `headlines.py` (it words the agent-against-search sentence), with the same value as `exam.ts`; `web/tests/unit/exam.test.ts` pins both and that no other server file holds it.
- **Wording that departs from `design/README.md`**: the built page says "Running it live" and "Only a live run runs the agent" (the page has no Play button), and the headline lead has a separate case for no language model.
- **Autoplay** starts only when the player is on screen once the page above it has filled in, and again when it scrolls into view (not at the first moment the empty page makes it visible).
- **Owner steps left**: record the real run (`scripts/record_run.py`) and set `VITE_APP_URL` in `web/.env`; `uv run pytest -m release` checks both.
