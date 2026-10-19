# Implementation Plan: Validation versus Test: Making the Two Tabs Agree

**Branch**: `016-validation-vs-test` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its 2026-10-19 clarifications), the approved design in [design/README.md](design/README.md) (authoritative over the two HTML files, which are pictures only), and the planning brief. New copy says "candidate model", never "setup".

## Summary

Both tabs are already built from the replayed run state. This feature adds one shared browser module, `web/src/page/exam.ts`, holding the only definition of the too-close threshold and the exam pill and banner builders, and then changes the section modules of What the agent found (`found/`) and The final test (`final/`) to use it. The backend change is small and calculates nothing: takeaway 1 gets a "totals have risen" variant (facts and template wording in `cricket_facts.py` and `cricket_blocks.py`), the `propose_features` prompt asks for reasons in plain cricket words, and the explanation wording drops the last uses of "winner". No new dependency, and no new field is needed in the replay state: every figure already reaches the browser (see [research.md](research.md)).

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript, no framework (web)
**Primary Dependencies**: existing only (FastAPI, LangGraph; Vite, Vitest, Playwright). No new dependency
**Storage**: none; the tabs read the replayed run state
**Testing**: pytest (takeaway 1 variants, prompt wording, no "winner" in the explanation text), Vitest on pure view and copy functions (no DOM library is installed, so DOM checks are Playwright), Playwright with the fake model (`llm_fake`; no test calls a real model)
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: both tabs re-render on each replay step; at most 4 bars, two small cards and a few reasons, so imperceptible
**Constraints**: every number from the run's state; the language model writes words only through placeholders; the server never decides "too close to call" and holds no copy of the threshold; the OpenRouter key never reaches the browser and the model picker stays a server-side allowlist (neither is touched); the test year is still scored only in `final_test` and no test figure shows before the final test step; no animation; no sideways scroll at 360 px; other tabs, the graph and the live summary line unchanged
**Scale/Scope**: 4 backend files touched, 1 new browser module plus 1 new final-tab section module, about 8 existing page modules edited, CSS for the pills, banners, cards and reasons

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | The threshold is defined once, in `exam.ts`; every figure is read from existing state fields; the count of candidate models is the AI's fitted attempts plus the grid's allowed cells, as the data table says |
| No numbers typed into the page | Only number-free copy is typed; a Playwright test compares every number on both tabs with the run's state; "dozens" is never typed |
| Wording never contradicts figures | "Too close to call" and every sentence under the bars, in section 2 and in the choice panel are chosen by pure functions from displayed one-decimal scores, each tested on at least three figure sets; takeaway 1's new variant is chosen by code and its direction words come only from placeholders |
| The test year stays unseen before the test | Test figures come from `final.accuracy`, which exists only from the `final_test` step on; nothing new reads the test slice |
| A failure never shows invented numbers | Without the AI's model or without a scorable AI candidate model the pages show the rival alone, with no comparison and no "too close to call" |
| No new dependencies | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/016-validation-vs-test/
├── plan.md
├── research.md            # where the threshold lives; which state fields reach the browser; decisions and reconciliations
├── data-model.md          # the exam view types and the pure copy functions
├── quickstart.md          # run the suites; how to see the design's run say "too close to call" on both tabs
├── contracts/exam-tabs.md # the two tabs' DOM and data-testid contract, extending the 014 and 015 contracts
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── cricket_facts.py        # CHANGED: new facts know_nothing_rising, know_nothing_bias_runs, know_nothing_bias_direction (existing is_large_bias rule); facts for the removed "shortest bar" sentence dropped; "winner" removed from fact meanings the model reads
├── cricket_blocks.py       # CHANGED: _takeaway_run_rate gains the "Scores keep climbing" variant; _verdict drops the race-leader sentence
├── prompts.py              # CHANGED: the "reason" instruction asks for plain cricket words, no figures, no column names, no feature or menu ids
└── llm_fake.py             # CHANGED only if the scripted reasons need to follow the new instruction (no digit, no id)
tests/
├── test_cricket_blocks.py, test_cricket_facts.py   # CHANGED: the takeaway 1 variants; the removed sentence and facts
├── test_prompts.py                                 # CHANGED: the new reason instruction
└── test_explanation_numbers.py                     # CHANGED: fixture gains a know-nothing bias argument

web/src/page/
├── exam.ts                 # NEW: TOO_CLOSE_RUNS, tenths helpers, tooClose(), compare(), examPill(), examBanner(), check/test years from the split
├── found/
│   ├── index.ts            # CHANGED: the banner under the lead; section 2 and 3 headings
│   ├── view.ts             # CHANGED: tenths helpers re-exported from exam.ts; WinnerView becomes ChoiceView with the pure copy decisions
│   ├── seasons.ts          # CHANGED: heading lead, validation outline and fill, caption row
│   ├── race.ts, race-layout.ts  # CHANGED: axis label, labels "on the check seasons", caption; the winner panel becomes the choice panel
│   ├── contest.ts          # CHANGED only where it says "winner"
│   ├── grid.ts, ranking.ts # CHANGED: score labels "on the check seasons", column heading
├── final/
│   ├── index.ts            # CHANGED: TEST banner, four numbered sections
│   ├── view.ts             # CHANGED: PLACES and placeLabel removed; exam scores and candidate-model count; headerLead per the README
│   ├── pick.ts             # NEW: the our-pick card and the goal verdict card beside it
│   ├── race.ts             # CHANGED: no place labels, "our pick" tag, the AI-versus-rival sentence
│   ├── differ.ts           # NEW: section 2, "Why the scores differ from What the agent found"
│   ├── copy.ts             # NEW: the pure sentences (compare under the bars, who was ahead, "Both gaps are tiny", the reasons)
│   ├── closeness.ts        # CHANGED: section 3, "Every <year> innings", "Even our pick…" with the chosen model's share
│   └── takeaways.ts        # CHANGED: section 4
web/index.html              # CHANGED: --val token (light and dark), .exam-pill, .exam-banner, .pick-card, .differ cards, .reasons; the full-width leads (already applied) kept
web/tests/
├── unit/exam.test.ts, final-copy.test.ts, found-choice.test.ts   # NEW
├── unit/found-view.test.ts, final-race.test.ts, final-closeness.test.ts, final-fixtures.ts   # CHANGED where they checked the winner view, place labels or the closing line
└── e2e/found.spec.ts, final.spec.ts, llm-run.spec.ts, tabs.spec.ts   # CHANGED where they checked wording or structure this feature changes
```

## Design notes

- **One threshold, in the browser.** `exam.ts` exports `TOO_CLOSE_RUNS = 0.5` and `tooClose(a, b)`, which compares tenths of a run (`|round(a·10) − round(b·10)| < 5`), so 0.49 is too close and exactly 0.5 is not, and the page can never call a gap "too close" that its own one-decimal figures show as 0.5 or more. `grep` for `0.5` or `TOO_CLOSE` in `backend/` must find nothing (a unit test asserts the server holds no copy).
- **Pure copy decisions.** Each new sentence is a pure function of numbers: `choiceView()` (found), and `compareSentence()`, `leadSentence()`, `bothTiny()`, `reasonTwoText()` (final). The renderers only place the strings. Vitest drives them at gaps of 0.49, 0.5 and 1.2 on both exams, and with at least three differing figure sets each.
- **The choice panel.** States: `pending` (the search is still going), `clear` (a gap of 0.5 or more), `whisker` (under 0.5, includes a tie and a displayed tie when the rival was recorded as chosen), `noAi` (no scorable AI candidate model: the rival goes forward with no comparison and no "too close to call"). The recorded `validation_winner` is never overridden; the panel only describes it.
- **Final tab data timing.** The bars, our-pick card, section 2 and the closeness bars need only `final` and the run's `attempts`/`grid`/`split`, so they show at the `final_test` step. The goal verdict card, the closing line and section 4 come from the explanation, one step later, as in feature 015.
- **Without the AI's model.** `final.llm_took_part` is false and `final.validation_mae.llm` is null: section 2 shows the rival's two scores alone with the three reasons, the comparison sentence and the lead's "who was ahead" are dropped, and `tooClose` is never evaluated.
- **Word "winner".** The only visible uses are `closeness.ts` ("Even the winner") and the old panel; both go. The `winner-*` class names and the `winner-panel` test id are renamed to `choice-*`. The explanation facts' `meaning` text (read by the language model) drops "winner" so the model is not prompted to repeat it.

## Tests

- **Vitest (pure)**: `tooClose` at 0.49, 0.5, 1.2 and at equal values (both exams); `choiceView` for clear, whisker, tie, displayed-tie, no-AI and pending; each final-tab sentence on at least three figure sets (the AI ahead on both, the rival ahead on both, split by exam; both gaps tiny, one tiny, neither); the shared scale of the two cards; the candidate-model count from the AI's fitted attempts plus the grid's allowed cells; a source-text check that `TOO_CLOSE_RUNS` is defined once in `web/src`.
- **pytest**: takeaway 1 variants (clearly, barely, none, and the new "rising" variant for a know-nothing guess that passes the large-bias rule and leans too low, plus the cases where it does not apply: not large, or leaning too high); direction words only through placeholders; the prompt's reason instruction (plain cricket words, no figures, no column names, no ids) and that no feature id or menu id appears in its example reason; the server holds no too-close threshold; no "winner" in the explanation's text.
- **Playwright (fake model)**: both banners and pills; section order 1 to 4 on The final test; leads as wide as their container; no sideways scroll at 360 px with the banners wrapping and the cards and reasons stacked; 4.5:1 contrast of every new pill, banner, card and panel text in light and dark (computed from the page's own colours); the design's run (validation: rival 17.0, AI 17.4; test: AI 17.7, rival 17.8) says "too close to call" on both tabs, and a gap of 0.5 or more says it on neither; the word "winner" appears on neither tab for an LLM run, a no-LLM run and a run where the pick lost the test; the no-LLM run shows one model only, no "too close to call", and names the rival.
- Existing tests change only where they checked wording or structure this feature changes (the winner panel, place labels, the closing line, section numbers and headings).
