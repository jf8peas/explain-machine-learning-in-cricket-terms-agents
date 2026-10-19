# Implementation Plan: "The final test" Tab Redesign

**Branch**: `015-final-test-tab` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)
**Input**: The specification, the approved design in [design/README.md](design/README.md) (authoritative over `final-test-tab.html`), and the planning brief.

## Summary

Replace the final test renderer (`renderFinal` in `results.ts`, the comparison box, `accuracy.ts`, the scatter plot `accuracy-chart.ts` and `cricket-terms.ts`) with a composer that builds three numbered sections from the run state, one small module per section in `web/src/page/final/`.

The backend change is feature 012's machinery with a different block set. `cricket_blocks.py` offers five blocks: `verdict`, `takeaway_run_rate`, `takeaway_drivers`, `takeaway_tv`, `rule_of_thumb`. The first and last are code-only (template wording, never offered to the language model); the language model writes only the three takeaways, through the existing `write_in_cricket_terms` step. `cricket_facts.py` gains named views of figures the final state already holds (no calculation changes). `writing_reply.py` also rejects direction words written by the model. `final_test` stops producing `chart_points`. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript, no framework (web)
**Primary Dependencies**: existing only (FastAPI, LangGraph; Vite, Vitest, Playwright). No new dependency
**Storage**: none; the tab reads the replayed run state (`final`, `explanation`, `split`)
**Testing**: pytest (facts, blocks, reply checks, final state), Vitest with fixture states (pure section logic), Playwright with the fake model (page behaviour)
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: the tab re-renders on each replay step; at most four bars and a handful of feature rows, so imperceptible
**Constraints**: no figure typed into the page; direction words reach the page only through placeholders; no animation; no sideways page scroll at 360 px; other tabs, the graph and the summary line unchanged
**Scale/Scope**: 7 backend files touched (`cricket_blocks`, `cricket_facts`, `writing_reply`, `prompts`, `llm_fake`, `nodes`, `scoring`, plus `state`), 4 new page modules plus a composer, 4 front-end files removed

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | Every figure is a named fact or a `final.accuracy` figure; the "barely helps" threshold stays in `hero_text.py` and is imported, not copied |
| No numbers typed into the page | Only number-free copy is typed; a Playwright test compares every number on the tab with the state read from the replay event |
| Wording never contradicts figures | Verdict and rule of thumb are code-only; direction words reach takeaways only through placeholders; each variant is chosen by code |
| A failure never shows invented numbers | Language model failure or unusable reply falls back to template wording per block (existing behaviour) |
| The test year stays unseen before the test | Nothing here reads the test slice; `final_test` still reads it once |
| No new dependencies | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/015-final-test-tab/
├── plan.md
├── research.md            # decisions and the reconciliations with the spec
├── data-model.md          # facts, blocks, derived view models, rounding and share rules
├── quickstart.md          # run the three test suites, look at the tab
├── contracts/final-test-tab.md   # state shape changes, block contract, DOM and test ids
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── cricket_blocks.py   # CHANGED: BLOCK_IDS = verdict, takeaway_run_rate, takeaway_drivers, takeaway_tv, rule_of_thumb;
│                       #   MOVABLE = (); new CODE_ONLY = (verdict, rule_of_thumb); how_chosen, closing, wicket blocks and
│                       #   their templates removed (wicket cost moves into takeaway_drivers); verdict gains three variants
│                       #   and the optional race-leader sentence; templates chosen by code from the facts
├── cricket_facts.py    # CHANGED: new named views (see data-model.md); CLOSING_LEADS removed; how_chosen-only facts
│                       #   (check_year_*, training_from/to, winner_validation_error) removed if nothing else uses them
├── hero_text.py        # UNCHANGED: BARELY_HELPS_SHARE and barely_helps() stay the one place; cricket_facts imports them
├── writing_reply.py    # CHANGED: reject direction words written by the model; no order / closing_lead handling
├── prompts.py          # CHANGED: writing prompt and schema cover only the takeaway blocks, no reorder / closing lead
├── llm_fake.py         # CHANGED: scripted writing reply for the three takeaways (placeholders for direction words)
├── nodes.py            # CHANGED: write_in_cricket_terms offers only the LLM blocks; code-only blocks pass through;
│                       #   final_test no longer returns chart_points
├── scoring.py          # CHANGED: chart_points() removed; final_scoring() returns only the additions
└── state.py            # CHANGED: chart_points field removed
tests/                  # CHANGED where listed under Tests below

web/src/page/
├── final/
│   ├── index.ts        # NEW: renderFinal(target, state) composer: header, then sections 1 to 3
│   ├── view.ts         # NEW: pure view of final + explanation: rows sorted by average miss, labels, chosen/leader flags
│   ├── race.ts         # NEW: section 1 (bars, axis, verdict line); pure scale/order helpers exported for tests
│   ├── closeness.ts    # NEW: section 2 (stacked bars, key, bias words, closing line); pure `shares()` exported
│   ├── takeaways.ts    # NEW: section 3 (cards, label, rule of thumb); drivers mini-chart helpers `bars`/`driversText` (moved from cricket-terms.ts)
│   └── types.ts        # NEW: Fact, Block, CricketExplanation, Final types (moved from cricket-terms.ts / results.ts)
├── results.ts          # REMOVED (renderFinal moves to final/index.ts)
├── accuracy.ts, accuracy-chart.ts, cricket-terms.ts   # REMOVED
└── main.ts             # CHANGED: imports renderFinal from "./final"
web/index.html          # CHANGED: CSS for the three sections; comparison box, accuracy table, scatter plot, drivers/years-strip/wicket-figure/goal-badge CSS removed where unused; --m-know-nothing, --tv, --win/--lose reused
web/tests/
├── unit/final-*.test.ts   # NEW: race, closeness, takeaways; cricket-terms.test.ts and accuracy-chart.test.ts removed or moved
└── e2e/final.spec.ts      # NEW; cricket-terms.spec.ts, explanation.spec.ts, reference.spec.ts, tabs.spec.ts, llm-run.spec.ts updated where they touched removed parts
```

## Design notes

- **Verdict and the two code-only blocks.** `verdict` and `rule_of_thumb` come out of `build_blocks` with template wording and are filtered out of what `write_in_cricket_terms` offers and parses. A reply that names them is ignored (the existing "not one of the offered blocks is ignored" rule), so they can never carry model words.
- **Direction words.** Facts hold them as values (`tv_bias_direction` = "too low" / "too high" / "about right", `rule_verb` = "add" / "take off"). The model writes `{tv_bias_direction}`; code fills it. `writing_reply` rejects, outside placeholders, the words and close variants listed in research.md, matched on whole words so ordinary words such as "overall" or "address" still pass.
- **When the pieces appear.** Sections 1 and 2 (bars, bias words) need only `final` and show at the `final_test` step. The verdict line, the "chosen before the test" sentence, the section 2 closing line and section 3 need the explanation facts and appear at the next step (`explain_in_cricket_terms`). Before then those slots are absent, not placeholder text. Before `final_test` the tab shows its existing "not ready" sentence.
- **Without the language model.** `final.methods` already omits `llm`: three rows follow with no further code. `final.winner` is `forward`, so the verdict names "the rival's model".
- **Names on the page.** The four method names and one-line descriptions are page copy from the design README, keyed by method id in `final/view.ts`. `methods.py` and the other tabs are unchanged.

## Tests

- **pytest**: facts for at least three figure sets (TV barely vs clearly better, TV bias low/high/small, chosen model with and without a wicket feature); each verdict variant and the extra sentence only when the race leader differs from the chosen model; the rule of thumb's verb and wording follow the bias; writing replies rejected for direction words as well as digits and number words, with per-block fallback intact; code-only blocks never offered; `final_test` emits no `chart_points`.
- **Vitest**: bar scale (next 10) and ordering; shares always total 100 for generated figure pairs; three-row layouts without the AI model; drivers chart sides and order; words table boundaries.
- **Playwright (fake model)**: three numbered sections, no `details`; every number equals the run state; verdict variants via fixtures; model-written versus template label; stepping back before `final_test` shows the "not ready" sentence; light and dark; no sideways scroll at 360 px.
- Existing tests change only where they checked the removed comparison box, accuracy table, scatter plot, `chart_points`, or 012's old block ids.
