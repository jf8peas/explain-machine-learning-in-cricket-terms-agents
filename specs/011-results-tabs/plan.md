# Implementation Plan: Results in Tabs That Follow the Process

**Branch**: `011-results-tabs` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its clarification) and the planning brief. Choices the brief left open are in [research.md](research.md).

## Summary

The page's single results block is split across three new tabs, in the order of the process: Data, Working, What the agent found, The final test, Try your own innings. The existing `<tab-set>` gains four generic abilities (select with focus, markers, a live region, a self-scrolling tab list); `<graph-replay>` gains two generic fields on its `replaychange` event (a run number and a failed flag). `renderResults` is split into `renderFound` and `renderFinal`, both still rendered from the state at the step on display, so results fill in as the replay shows them. A pure, unit-tested readiness state machine decides when each tab is ready, which markers to show and when to switch to What the agent found; `main.ts` only wires events to it. A one-line summary under the graph shows the same leader the leaderboard shows. No backend change and no new dependency.

## Technical Context

**Language/Version**: TypeScript, no framework (vanilla custom elements), Vite
**Primary Dependencies**: existing only. No new dependency
**Storage**: None
**Testing**: Vitest (`web/tests/unit`), Playwright (`web/tests/e2e`, fake model, in-memory limit store)
**Target Platform**: evergreen browsers, light and dark themes, phone to desktop
**Project Type**: web app inside the uv-workspace monorepo (`apps/linear_regression/web`)
**Constraints**: generic components know nothing of this app; every existing `data-testid` is kept and moves with its element; panels are hidden, never removed (a run, inputs and scroll positions survive switching); no animation; the page never scrolls sideways; no backend change
**Scale/Scope**: 5 tabs, 2 renderers, 1 summary module, 1 state machine, 2 component extensions

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles applied from earlier features:

| Principle | How the plan meets it |
|---|---|
| Generic components stay generic | `tab-set` and `graph-replay` gain only app-free features; the app rules live in `src/page/` |
| Logic is pure and unit-tested | The readiness and auto-switch rules are one pure function with its own tests |
| One source for each fact | The summary line uses the leaderboard's own ordering function; the tab list comes from the page's panels |
| No new dependencies, no backend change | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-results-tabs/
├── plan.md
├── research.md
├── data-model.md        # readiness state, replaychange detail, actions
├── quickstart.md
├── contracts/ui.md      # tab ids, test ids, events and methods
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/web/`)

```text
index.html                    # CHANGED: five panels; intro moved into Working; results/try-it split
src/tab-set/tab-set.ts        # CHANGED: select(id,{focus}), setMarker(id,on), live region, scrolling tab list
src/graph-replay/graph-replay.ts   # CHANGED: replaychange detail gains `run` and `failed`
src/page/results.ts           # CHANGED: renderResults -> renderFound + renderFinal; data error removed
src/page/leaderboard.ts       # CHANGED: export the ordering function
src/page/summary.ts           # NEW: the summary line under the graph (and the data error)
src/page/readiness.ts         # NEW: pure state machine (state, detail) -> (state, actions)
src/page/main.ts              # CHANGED: wiring only
tests/unit/readiness.test.ts, summary.test.ts, tab-set.test.ts   # NEW
tests/e2e/tabs.spec.ts        # NEW; existing e2e that expect results on Working open the right tab first
```

**Structure Decision**: keep the existing folders; the two new modules sit with the page modules because they hold app rules.

## Design

### Page structure (`index.html`)
One `<tab-set default-tab="working" aria-label="Page sections">` with panels in this order: `data`, `working`, `found`, `final-test`, `try-your-own` (these are the link ids; labels Data, Working, What the agent found, The final test, Try your own innings). The introduction section moves from above the tab set to the top of the Working panel; the Data panel is unchanged. Each panel starts with an `h2 tabindex="-1"`. Each result panel holds a "not ready" paragraph (one sentence and a link to `#working`), its content container and the Cricsheet attribution line. Existing test ids move with their elements; the old `results` id stays on the What the agent found container, and The final test gets its own (`results-final`). Working holds the intro, catalogue, picker, variation note, `<graph-replay>` and the summary line.

### Renderers (`results.ts`)
`renderFound(target, state)`: the "language model used" line, the language-model notice, the leaderboard, the grid search and the model's reasoning; once `final` exists, a link to `#final-test`. `renderFinal(target, state)`: the final comparison, the accuracy table and chart, the two best-setup lines, the explanation and the "no method can be perfect" note. Both render from the replaychange state at the step on display, so What the agent found fills in step by step and The final test appears when the `final_test` step is shown. A data error is no longer rendered here: it shows on the Working tab in the summary line's place.

### Summary line (`summary.ts`)
Before any run: one sentence that results will appear here and in the result tabs. During and after a run: the leading attempt at the step on display, its average miss, who proposed it, and a link to `#found`. It imports the leaderboard's now-exported ordering function so the leader is always the same as the leaderboard's. A data error replaces the line with the error text (`role="alert"`, test id `data-error` kept).

### `<graph-replay>` additions
`replaychange` detail gains `run` (a counter that goes up by one each time a new run starts) and `failed` (true when the stream ended with an error event, or the connection was lost before the run finished). Both are set in the component's own run handling; the component does not interpret them.

### `<tab-set>` additions
- `select(id, { focus })`: switches through the same hash mechanism as a click, so Back and Forward work; with `focus`, moves focus to the panel's first `[tabindex="-1"]` heading **after the panel is shown** (the hash change is handled asynchronously and a hidden panel cannot take focus), for example on the resulting `tab-show`.
- `setMarker(id, on)`: a small dot plus visually hidden text ("new results") inside that tab's button, so it does not rely on colour; showing a tab clears its marker.
- A polite live region inside the component announces programmatic switches ("Now showing: What the agent found").
- Narrow widths: the tab list scrolls sideways inside itself (`overflow-x: auto`, no wrapping) and the selected tab is scrolled into view; the page never scrolls sideways. No animation.

### Readiness and auto-switch (`readiness.ts`)
`step(prev, detail) -> { state, actions }`, pure. State: `{ run, ready: {found, final, tryit}, switched }`. Rules from the brief and the clarification:
- A new `run` number resets every result tab to not ready, clears `switched`, and leaves the current tab alone.
- found is ready once the state on display has an attempt or a reasoning round; final once it has the final state; try-your-own once `finalState` holds a model.
- A tab's marker is set when it becomes ready and it is not the one showing (the machine receives the active tab id). The marker **latches**: it stays until that tab is shown, even if the visitor steps back. The "not ready" sentence and the content **follow the step on display**, so they are recomputed on every detail (the machine returns `notReady` actions with the current truth), while `tryit` readiness comes from `finalState` and so does not revert within a run.
- When `atEnd`, not `failed`, no data error and this run has not switched: action `switch found (focus)`; `switched` is set. Stepping back, forward or jumping afterwards never switches again for that run.
- Actions: `show/hide not-ready text`, `set/clear marker`, `switch`. `main.ts` carries them out through `tab-set` and the renderers.

### Wiring (`main.ts`)
On `replaychange`: render found and final from `detail.state`, run the machine, perform its actions. On `tab-show` for a tab: clear its marker. The try-your-own form keeps what was typed through tab switches and new runs (it already keeps its own inputs; the form is hidden, not rebuilt).

## Complexity Tracking

| Departure | Why |
|---|---|
| The intro moves into the Working panel | Required by the spec: the page opens on Working, and Working must hold the intro |
| Two new page modules | The state machine and the summary are the testable parts; keeping them out of `main.ts` keeps `main.ts` as wiring |

## Testing

- **Vitest**
  - `readiness.test.ts`: switches exactly once at the end; no switch before the end, after a pause or on failure or with a data error; resets on a new run without touching the current tab; found, final and try-your-own readiness rules; marker set when ready and not showing, cleared when shown; data on the Data tab still switches.
  - `summary.test.ts`: the leader named is the leaderboard's leader for several attempt sets (ties, rival vs model, rejected); the pre-run sentence; the data error replaces the line.
  - `tab-set.test.ts`: `select` changes the tab and the hash; `focus` moves focus to the heading; `setMarker` adds and removes the dot and hidden text; showing a tab clears its marker; the live region text.
- **Playwright** (`tabs.spec.ts`, plus updates)
  - First load shows Working; Data is the first tab; Working holds intro, picker, graph and summary and none of the results.
  - Each tab opens from its link; Back and Forward move between visited tabs; a link opened before any run shows the not-ready sentence and the link to Working.
  - A full run switches to What the agent found at the end with focus on its heading; pausing one step before the end delays the switch until stepping to the end; stepping back and forward afterwards does not switch again; being on Data at the end still switches; a data-error run does not switch and shows the error on Working.
  - Switching tabs mid-run does not restart or pause it, and playback keeps advancing while the Working panel is hidden.
  - Typed try-your-own inputs survive switching and a new run; markers appear and clear; keyboard-only navigation works; at phone width all five tabs are reachable with no sideways page scroll.
- Existing e2e tests that expect results on Working open the right tab first; no other test changes.

## Changes made while implementing

- **Leader**: the leaderboard lists attempts in the order fitted and has no ordering function, so `leader(attempts)` (lowest average error, the earliest wins a tie) is new in `leaderboard.ts`, and the summary line and its test use it.
- **Markers announce once per run** (`announced` in the readiness state), so stepping back and forward does not set a marker again.
- **Try your own innings**: its existing hint is its not-ready sentence (now with a link to `#working`); the form now keeps what was typed when a new run clears and rebuilds it.
- **`<tab-set>` has no unit test**: the repo's Vitest has no DOM environment and no DOM library may be added, so `select`, focus, markers, the live region and the scrolling bar are covered in `tests/e2e/tabs.spec.ts`; the pure readiness and summary rules have unit tests.
- **Test helpers**: `playToEnd`/`finishRun` now wait for the move to What the agent found and return to Working (and drop focus off the tab button, since arrow keys on a tab button move tabs); `openTab` and `afterRunOpen` open the tab a test needs.
