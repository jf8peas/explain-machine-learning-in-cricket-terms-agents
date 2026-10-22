# Implementation Plan: Goal First

**Branch**: `022-goal-first` (work is on `main`; no branch hook ran) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)
**Input**: The specification, [design/README.md](design/README.md) (source of copy and behaviour; the canvas is a visual reference only). Decisions and reasons are in [research.md](research.md); the page's state in [data-model.md](data-model.md); the interfaces in [contracts/](contracts/).

## Summary

Turn the main page from "a recorded result that plays itself" into "the reader states the goal, presses play, watches the graph, and sees the result when their run finishes". The backend gains a `start` event per node (so the page can ring the node in progress), a plain-words "doing" line per node, the goal card's words and a result-strip sentence. The recorded run, its scripts and the live-run panel are deleted; one page-level run state drives the player, the graph's ring and done styles, the status line and every lock. The graph is shown by default and follows the live run as it arrives. No new runtime dependency.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI, LangGraph 1.2); TypeScript 5 (Vite 5, no framework, custom elements)
**Primary Dependencies**: none new
**Storage**: none (nothing about a run is kept; a reload is idle)
**Testing**: pytest (`apps/linear_regression/tests`), Vitest (`web/tests/unit`), Playwright (`web/tests/e2e`, scripted fake models)
**Target Platform**: as 020 and 021 (390 × 664 phones up to desktop, light and dark; Vercel)
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: first screen needs no run and no recorded file; the graph and feed update as events arrive
**Constraints**: nodes, edges, prompts, scoring and the gate's logic unchanged; every number and data-dependent sentence from the backend; glossary (021) and banned-term check apply to all new words; word limits 500 / 1,200 before a run and after a fake-model run; 44 px targets (48 px for Play); no horizontal scroll
**Scale/Scope**: about 8 new and 22 changed source files, 12 deleted; about 8 new test files, 14 rewritten, 8 deleted

## Constitution Check

No constitution exists, so there are no gates. Principles carried from earlier features: one source for each fact (the run state, the lock wording and the step lines each live in one place); no new dependency; the test season stays sealed (the goal card reads only the *count* and year of the test slice, as the split step already shows; `test_no_test_year_leak` stays green); identifiers and test ids are not renamed unless a feature says so.

**Re-check after design**: no violations. One deviation to flag: the live display no longer paces events (research R2), which changes how 020's graph component behaves for a streaming run; replay keeps its pace.

## Project Structure

### Documentation

```text
specs/022-goal-first/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md              # the start event, structure.doing, reference.goal_card, headlines.result_strip, /api/run default model
│   └── page-contract.md    # sections, ids, test ids, states, locked-card copy, focus and announcements
├── checklists/requirements.md
├── design/                 # README.md is authoritative; the canvas is a visual reference
└── tasks.md                # created later by /speckit-tasks
```

### Source changes (in `apps/linear_regression/`)

**Backend (`backend/linreg/`, `api/`)**

| File | Change |
|---|---|
| `graph_api.py` | **Changed.** stream mode `tasks` added; emits `start` `{step, node}` per task start; `step`, `done`, `error` unchanged; stays generic |
| `wording.py` | **Changed.** add `doing_lines(test_year)`; docstring no longer names the reword script |
| `stage_info.py` | **Changed.** `structure_extras` adds `doing` (test year from the rolling checks, with a fallback) |
| `hero_text.py` | **Changed.** add `goal_card(goal, figures, training, test)` (sentence, two figure labels with years, "Judged on…" line) |
| `reference_api.py` | **Changed.** send `goal_card` and `test: {year, innings}`; on the failure path send the goal sentence only |
| `headlines.py` | **Changed.** add `result_strip` `{label, text}` to `build()`; same case logic and rounding as `vs_search` |
| `run_gate.py`, `model_options.py` | **Unchanged** (the default-model fallback already exists; tests added) |
| `methods.py` | **Changed.** drop nothing from the glossary; `terms_version` stays; no recorded-run mention |
| `api/index.py` | **Unchanged** (structure extras carry the new fields) |
| `vercel.json` | **Changed.** remove the `/recorded-run.json` cache header |

**Deleted**

| File | Why |
|---|---|
| `web/public/recorded-run.json` | the recorded run |
| `scripts/record_run.py` | makes it |
| `scripts/reword_recorded_run.py` | rewords it |
| `web/src/page/recorded.ts` | loads it |
| `web/src/page/live-panel.ts` | the live-run toggle and panel; the picker moves into `player.ts` |
| `web/src/page/scoreboard.ts` | the hero's Scoreboard card; its `Headlines` type moves to `headlines.ts` |
| `web/src/page/run-source.ts` | replaced by `run-state.ts` |
| `web/src/page/player-state.ts` | replaced by the button logic in `run-state.ts` |
| `tests/test_recorded_run.py`, `tests/test_reword_script.py`, `tests/test_fake_recording.py` | tests of the deleted files |
| `web/tests/e2e/recorded-run.spec.ts`, `web/tests/e2e/live-panel.spec.ts` | tests of the deleted behaviour (live-panel's cases are carried into `player.spec.ts`) |
| `web/tests/unit/recorded.test.ts`, `scoreboard.test.ts`, `player-state.test.ts`, `run-source.test.ts` | tests of the deleted files (their cases are carried into `run-state.test.ts` and `goal-card.test.ts`) |

**Front end, shared graph component (`web/src/graph-replay/`)**

| File | Change |
|---|---|
| `sse.ts` | **Changed.** parse `start`; `StreamHandlers.onStart` (optional) |
| `buffer.ts` | **Changed.** `inProgress`, `follow` (live display follows arrival), `failedNode`; node states derived from cursor and arrival |
| `graph-replay.ts` | **Changed.** ring, done and error states on nodes; `structure` getter; `replaychange` carries `inProgress`; error marks the running node; no cricket words |
| `rows-view.ts`, `styles.ts` | **Changed.** `data-state` on nodes (running ring 3 px accent, done green, error); colour plus shape |
| `structure.ts` | **Changed.** optional `doing` map |

**Front end, page (`web/src/page/`)**

| File | Change |
|---|---|
| `run-state.ts` | **New.** the page-level run state and its pure derivations (phase, `last`, locks, button, status text) |
| `player.ts` | **New.** "Choose the AI" select, Play / Running… / Run again / Watch it again, run-length line, the shown status line and the hidden announcement region, refusal and failure messages |
| `right-now.ts` | **New.** the "Right now" card (step, doing, round, best so far, "Stopped: …") |
| `locked.ts` | **New.** the locked-card element and its wording for before / during / failed |
| `goal-card.ts` | **New.** the goal card and the result strip, drawn from `goal_card` and `result_strip` |
| `watch.ts` | **Rewritten.** loop strip, player, graph by default with the agent explanation and legend, Right now, feed; no autoplay, no recorded run |
| `hero.ts` | **Rewritten.** question, lead, "▶ Start the experiment", goal card; Commentary with the extra "why a season it never sees" |
| `main.ts` | **Changed.** wires run state, hero, player, verdict, Your turn, Scorebook; no recorded loading |
| `verdict.ts` | **Changed.** locked card until the final test; "AI agent ({model})" bar label |
| `tryit.ts` | **Changed.** locked card until a run finishes |
| `scorebook.ts` | **Changed.** run-dependent cards show "Available after a run" and do not open |
| `models.ts` | **Changed.** drop `limitsText` use from the player; keep list loading and `runUrl` |
| `round-feed.ts`, `found/view.ts` | **Changed (small).** empty-state line; "recorded" removed from comments and strings |
| `reference-types.ts` | **Changed.** `goal_card`, `test` |
| `simple.css`, `commentary.css` | **Changed.** player controls, status line, Right now, locked cards, goal card, result strip, node states |
| `web/index.html` | **Changed.** hero and section skeleton (`#problem`, `#watch`, `#verdict`, `#try`), new preview tags |
| `web/under-the-hood.html` | **Changed.** recorded-run mentions removed |

**Docs**: `README.md` (recorded-run and live-panel bullets replaced), `CLAUDE.md` (plan pointer).

### Tests

| Test | Fate |
|---|---|
| `tests/test_start_events.py` | **New.** `start` precedes its `step`, one per node, `done` last; generic for a small test graph and for the real graph; a failing node gives `start` then `error` |
| `tests/test_api.py` | **Kept**, event counts and order updated; add: `/api/run` with no model uses the default (model_name) |
| `tests/test_stage_info.py`, `tests/test_structure_stages.py` | **Rewritten in part.** every node has a `doing` line, none banned; the web fixture of the structure regenerated |
| `tests/test_hero_text.py`, `tests/test_reference_api.py` | **Extended.** `goal_card`, `test`, failure path |
| `tests/test_headlines.py` + `web/tests/fixtures/headline_cases.json` | **Extended.** `result_strip` for each case |
| `tests/test_wording_no_banned.py` | **Changed.** the recorded-run case is replaced by the fake-run fixture and the new lines |
| `tests/make_fake_run.py`, `tests/test_fake_run_fixture.py` | **New.** rebuild the scripted fake-run fixture in process; fail if it is stale |
| `web/tests/fixtures/recorded-run.fake.json` | **Renamed** `fake-run.json` (test fixture, events only) |
| `web/tests/unit/run-state.test.ts` | **New.** every transition, the locks, the button and status per phase, `last` kept across a second run and a failure, nothing persisted |
| `web/tests/unit/goal-card.test.ts` | **New.** (replaces scoreboard.test.ts) card and strip from the server's words |
| `web/tests/unit/buffer.test.ts`, `graph-replay-generic.test.ts`, `sse.test.ts` | **Extended.** `start` parsing, follow mode, node states, error node |
| `web/tests/unit/no-literal-terms.test.ts` | **Kept** (new files are scanned) |
| `web/tests/unit/found-view.test.ts`, `found-choice.test.ts`, `stage-colours.test.ts`, `under-the-hood-figures.test.ts` | **Kept**, fixture path updated |
| `web/tests/e2e/helpers.ts` | **Changed.** `runToEnd`, `fakeRun`, `serveRun` from fixture events; `finishRun` removed |
| `web/tests/e2e/idle.spec.ts` | **New.** (replaces first-screen) 390 × 664: h1, goal sentence, Start button visible, no agent figure, no horizontal scroll, no request for a recorded file, reload returns to idle |
| `web/tests/e2e/player.spec.ts` | **New.** select and button states, status line, "Watch it again" makes no `/api/run` request, Run again, model list failure falls back to the default, run-length line |
| `web/tests/e2e/graph-run.spec.ts` | **New.** `fake/slow`: exactly one node ringed while running, done never decreases, after the run none ringed, Right now card contents, "Show me everything" controls |
| `web/tests/e2e/locks.spec.ts` | **New.** verdict, Your turn and Scorebook locked before, during, after a failure; unlocked after; a second run keeps the first's results; a failed second run keeps them |
| `web/tests/e2e/failure.spec.ts` | **New.** gate refusal (`role="alert"`), mid-run failure (error node, "Stopped: …", rounds stay) |
| `web/tests/e2e/hero.spec.ts`, `verdict.spec.ts`, `tryit.spec.ts`, `scorebook.spec.ts`, `watch.spec.ts`, `play.spec.ts`, `stages.spec.ts`, `llm-run.spec.ts`, `live-region.spec.ts`, `preview-tags.spec.ts`, `data-tab.spec.ts`, `contrast.spec.ts`, `detail-level.spec.ts`, `navigate.spec.ts`, `brute-force.spec.ts`, `terms-brackets.spec.ts`, `banned-terms.spec.ts`, `word-count.spec.ts` | **Rewritten** to drive a fake-model live run (`runToEnd`) or to serve a fixture stream; copy expectations updated |
| `first-screen.spec.ts` | **Deleted** (replaced by `idle.spec.ts`) |
| `anchors`, `graph-rows`, `panels`, `phone`, `problem`, `reference`, `reuse*`, `structure`, `under-the-hood` e2e specs | **Kept**; small copy updates where they mention the recorded run or the old card |

## Implementation Order

1. **Backend.** `start` events in `graph_api.py`; `doing_lines` and `structure_extras.doing`; `goal_card` and `test` in `/api/reference`; `result_strip` in `headlines`; the default-model test. Backend tests; regenerate the structure and headline fixtures.
2. **Remove the recorded run and fix what depended on it.** Delete the files above; rename the fixture to `fake-run.json` and add `make_fake_run.py` and its staleness test; point the unit tests at it; replace the e2e helpers (`runToEnd`, `fakeRun`, `serveRun`); remove the `vercel.json` header and README bullets. The suites compile and the page still shows the old hero with a stub run state.
3. **Run state and locks.** `run-state.ts` with its unit tests; `locked.ts`; wire `main.ts` so every section reads `last` and the locks.
4. **Hero goal card.** `hero.ts`, `goal-card.ts`, `index.html` skeleton, Start button behaviour (scroll and focus), hero Commentary.
5. **Player, graph, Right now, explanation.** `sse.ts`/`buffer.ts`/`graph-replay.ts` start events, follow mode and node states; `player.ts`, `right-now.ts`; `watch.ts` rewrite; graph by default, stage legend only with Show me everything, replay controls after a run.
6. **Verdict, Your turn, Scorebook locks.** `verdict.ts` (model name on the bar), `tryit.ts`, `scorebook.ts`.
7. **"How this app was built" and preview tags.** Remove the recorded-run mentions; new title and description.
8. **Tests, word counts, 390 × 664.** The new specs and the rewritten ones; measure the word counts before a run and after a fake-model run and cut copy in the order in research R11 if over; the banned-term check on a finished fake-model run.

Each step ends with pytest, Vitest and Playwright green before the next (step 2 may need the e2e suites that depended on a recorded run to be skipped, marked `fixme`, until step 8 rewrites them; none is left skipped at the end).

## Risks

- **Pacing change (R2)** touches the shared graph component's behaviour for streaming runs. Mitigation: the buffer unit tests state both modes; the generic-fixture test (another app's graph) keeps passing.
- **Word counts (R11)** are tight (495 and 1,195 against 500 and 1,200 today); two states are now measured and cuts are pre-ordered.
- **Test cost.** Every end-to-end check that needed a result now needs a run (about 2 s on the fake model once the server is warm, more for the first). Mitigation: unit tests carry the logic; end-to-end tests that need only data use the fixture stream; `fake/quick` where several runs are needed.
- **Unlock timing.** Results unlock at the final test but the explanation steps follow; renderers must redraw on each later step so the takeaways fill in. Covered by a locks test that waits for `done`.

## Implementation notes (what changed from the plan while building)

- **Word counts.** After a run the main page was 720 words (simple) and 1,374 (everything open) against 500 and 1,200. The owner chose to count the graph's diagram labels apart (`data-diagram` on the graph's rows; the count helper skips it) and to trim copy besides; the cuts are listed in quickstart.md.
- **Graph component.** New attributes `compact` (hides the toolbar, status, path and the event and state panels) and `hide-legend`, and events `runopen`, `nodestart`, `nodestep`, `rundone`, `runerror`; node `data-state` is idle, running, done or error (`active` is the ringed node).
- **Start button.** It prevents the link's own navigation, pushes `#watch` itself and focuses the select, because following a fragment blurs the focused element.
- **Status line.** The shown line is not a live region; `player-announce` speaks phase changes and AI/code changes (about a dozen lines for a whole run).
- **Fixture.** `web/tests/fixtures/fake-run.json` is rebuilt in process by `tests/make_fake_run.py`; `backend/linreg/fingerprint.py` went with the recorded run.
- **Structure contract.** `specs/001-linear-regression-agent/contracts/structure.schema.json` gained the optional `doing` map.
