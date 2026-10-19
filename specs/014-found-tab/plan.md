# Implementation Plan: "What the agent found" Tab Redesign

**Branch**: `014-found-tab` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)
**Input**: The specification, the approved design in [design/README.md](design/README.md) (authoritative over `found-tab.html`), and the planning brief.

## Summary

Replace the What the agent found renderer (`renderFound` in `results.ts`, `leaderboard.ts`, `grid-view.ts`, the old `grid.ts` model) with a composer that builds six numbered sections from the run state at the step on display, one small module per section in `web/src/page/found/`. The backend change is small and calculates nothing new: `/api/catalogue` also serves `round_cap` (`ROUND_CAP`) and `grid_combinations` (the product of the three setup menus), and each setup menu option gains a `short` label defined in `setup_settings.py`. Everything else the tab needs is already in the run state. `leader()` keeps its export and meaning, because the summary line under the graph uses it. The race chart is a hand-built SVG that reuses `spreadLabels` from feature 013's `worm-layout.ts`. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript, no framework (web)
**Primary Dependencies**: existing only (FastAPI; Vite, Vitest, Playwright). No new dependency
**Storage**: none; the tab reads the replayed run state and `/api/catalogue`
**Testing**: pytest (catalogue additions), Vitest with fixture states (pure section logic), Playwright with the fake model (page behaviour)
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: re-render of the tab on each replay step stays imperceptible (a handful of rounds, at most 24 grid cells); `/api/catalogue` stays cached as today
**Constraints**: no number or candidate model description typed into the page; copy without numbers is typed as written in the README; reasons rendered as text, never HTML; no animation; no sideways page scroll at 360 px; other tabs, the graph and the summary line unchanged
**Scale/Scope**: 2 backend files touched, 6 new page modules plus a composer, 1 removed grid model/view pair and leaderboard renderer, CSS for the new sections

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | Counts and labels come from `/api/catalogue` (server settings); scores, years and the winner come from the run state |
| No numbers typed into the page | Only number-free README copy is typed; a Playwright test compares every number on the tab with the state read from the replay event |
| The test year stays unseen | The tab shows check-season scores only; the winner is read from `validation_winner`, set before the final test |
| A failure never shows invented numbers | Missing state (no attempts, no grid, no winner yet) shows the "still searching" or fallback wording, never a default figure |
| No new dependencies | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/014-found-tab/
├── plan.md
├── research.md
├── data-model.md          # the state fields read, the derived view models, ranking and rounding rules
├── quickstart.md          # run the three test suites, look at the tab
├── contracts/found-tab.md # the /api/catalogue additions; section DOM and test ids
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── setup_settings.py       # CHANGED: Option gains `short`; public_menus() serves {id, label, short}; grid_combinations() = product of the menu sizes
├── catalogue_api.py        # CHANGED: body gains round_cap (state.ROUND_CAP) and grid_combinations
tests/test_api_catalogue.py, test_setup_settings.py   # CHANGED: the new fields (round cap, combinations = 24, short labels present and unique per menu)

web/src/page/
├── found/
│   ├── index.ts            # NEW: renderFound(target, state, catalogue) composer: header, then the six sections in order
│   ├── view.ts             # NEW: pure derived view of the state at the step shown (joined rounds, best-so-far, rival, ranking, winner)
│   ├── contest.ts          # NEW: the two contest cards and the "why a rival" / "what's a candidate model" strip; the no-LLM card
│   ├── seasons.ts          # NEW: the season strip from the split
│   ├── race.ts             # NEW: the SVG race chart, its text equivalent, and the winner panel
│   ├── race-layout.ts      # NEW: pure: y range and whole-run gridlines, x positions (label spreading reuses spreadLabels)
│   ├── rounds.ts           # NEW: one card per round
│   ├── grid.ts             # NEW: the rival's grids as real tables (replaces page/grid.ts and page/grid-view.ts)
│   └── ranking.ts          # NEW: the ranked table and the TV line
├── leaderboard.ts          # CHANGED: keeps Attempt/RoundNote types, leader() and proposerName; renderLeaderboard and renderRounds removed
├── results.ts              # CHANGED: renderFound moves to found/index.ts; renderFinal and the rest unchanged
├── grid.ts, grid-view.ts   # REMOVED (replaced by found/grid.ts)
├── catalogue.ts            # CHANGED: Catalogue type gains round_cap and grid_combinations; Menus options gain `short`; a menuShort labeller
├── candidate model.ts                # CHANGED: MenuOption gains `short`; menuLabeller unchanged; a short-form labeller added
└── main.ts                 # CHANGED: passes the loaded catalogue to renderFound (the tab renders its text once the catalogue has loaded)
web/index.html             # CHANGED: CSS for the found tab (sections, cards, strip, chart, grids, ranking); old leaderboard/rounds/grid-table CSS removed; not-ready sentence reworded to the tab's new name
web/tests/
├── unit/found-*.test.ts    # NEW: view, race-layout, rounds, grid, ranking, contest-fallback; grid.test.ts rewritten for found/grid.ts
└── e2e/found.spec.ts       # NEW; existing specs touching the old leaderboard, grid or reasoning blocks updated (testids kept where meaning is unchanged)
```

**Structure Decision**: all derived facts (which rounds were fitted, best-so-far, the rival's visibility, ranking, winner wording inputs) are computed once in the pure `found/view.ts` and consumed by the section modules, so each rule is unit-tested without a browser and no module re-derives another's data.

## Design decisions

- **Step-by-step fill**: `renderFound` receives the state at the step on display, as today. The rival line and the grid appear only when `grid`/`forward_best` exist in that state (they are set at the `grid_search` step); the winner panel appears only when `validation_winner` exists. Nothing is hidden by CSS; absent state renders the pre-state wording.
- **Rounds join attempts**: a round with outcome `fit` takes its score and `improved` from the attempt with `proposer === "llm"` and the same `round`. The grid's best attempt has `proposer === "forward_selection"` and a `round` that is a step count, so it can never be confused with an AI round.
- **Rounding**: all displayed misses use one decimal (`fmt`). The gap in the winner panel and the "▼ drop" in round cards are computed from the already-rounded displayed values, so a reader can subtract them.
- **Winner**: `validation_winner.winner` is `"llm"` or `"forward"`; the panel shows both bests from `llm_best` and `forward_best`. The tie wording ("tie, the AI's candidate model goes forward") is used only when the displayed values are equal and the recorded winner is `llm`, matching `selection.validation_winner`; equal displayed values with the rival recorded as winner name the rival and say the gap is smaller than the display shows. The grid, rival line and rival rows arrive together at the `grid_search` step. With no LLM attempts the panel names the rival.
- **Ranking**: LLM attempts plus every allowed grid cell's best. The single `forward_selection` attempt is excluded because it equals the grid's best cell. Sort by `validation_mae` ascending; ties keep LLM attempts first, then grid order.
- **Grid shading**: stepped tint of `--m-forward` by rank of the cell's value (a fixed number of steps); the value is always printed; cells not allowed print "–" with the cell's note as accessible description (`aria-describedby` to a visually hidden note); the best cell has an outline, bold text and a star.
- **Chart**: label spacing reuses `spreadLabels` (already in `worm-layout.ts`, so no new shared helper is needed). The y range fits every plotted value, with gridlines at whole runs.
- **Look**: `--m-llm`, `--m-forward` and `--tv` already exist in `index.html` for both themes (feature 013 is built), so no token is added.
- **Catalogue timing**: labels and counts come from `/api/catalogue`; the tab renders its sections that need them once `loadCatalogue()` has resolved, and never shows an id or a placeholder number in their place.

## Complexity Tracking

No constitution violations. One departure from the brief's wording: the brief says to reuse "the label-spacing function from feature 013's worm chart if it exists"; it does (`spreadLabels` in `page/worm-layout.ts`), so it is imported rather than moved.
