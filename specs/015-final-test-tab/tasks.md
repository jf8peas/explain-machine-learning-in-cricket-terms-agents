# Tasks: "The final test" Tab Redesign

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/final-test-tab.md](contracts/final-test-tab.md), [research.md](research.md), [design/README.md](design/README.md) (authoritative for copy and layout)
**Tests**: requested in the planning brief (pytest, Vitest with fixture states, Playwright with the fake model).
**Paths**: all relative to `apps/linear_regression/` unless stated.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5 from the spec

---

## Phase 1: Setup

- [x] T001 Read the code and tests this rewrite touches and list in a scratch note which existing tests need updating: `backend/linreg/{cricket_blocks,cricket_facts,writing_reply,prompts,llm_fake,nodes,scoring,state}.py`, `web/src/page/{results,accuracy,accuracy-chart,cricket-terms,main}.ts`, and grep `tests/` and `web/tests/` for `chart_points`, `how_chosen`, `closing`, `closing_lead`, `CLOSING_LEADS`, `"wicket"`, `"drivers"`, `comparison`, `accuracy-table`, `accuracy-row`, `cricket-block`, `data-block`, `explanation`, `final-llm`, `final-tv`, `writer-label`, `writer-fallback`
- [x] T002 [P] Extend the fixture builder `state_for` in `tests/test_explanation_numbers.py` (keep its current arguments working) with arguments for the new figures: `tv_bias`, `tv_within_10`, `know_nothing_miss`, `accuracy` for all four methods (average_miss, within_10, within_20, bias, n), `llm_mae=None` for no AI model; add helper `three_figure_sets()` returning named sets used by later tests (TV barely better; TV clearly better; TV no better; bias too low; bias too high; bias small; with and without a wicket feature; rival's model has the shorter bar; TV has the shortest bar)
- [x] T003 [P] Create the folder `web/src/page/final/` and a fixtures file `web/tests/unit/final-fixtures.ts` exporting builders for a `final` + `explanation` state: four methods with an ordinary spread; no-AI variant (three methods, `winner: "forward"`, `llm_took_part: false`); rival-shorter-bar variant; TV-shortest variant; each verdict variant; a drivers set with mixed signs; a model without a wicket feature

---

## Phase 2: Foundational (blocks all user stories)

- [x] T004a Add `bias_phrase(bias)` to `backend/linreg/accuracy_text.py` (zero test and direction exactly as `bias_words`; returns "guesses about right on average" or "guesses N runs too low/high on average"), add `"bias_phrases": {m: accuracy_text.bias_phrase(f["bias"]) for m, f in acc.items()}` to the additions in `backend/linreg/scoring.py` `final_scoring`, and add pytest in `tests/test_accuracy_text.py` and `tests/test_reference_in_run.py` for zero, too low and too high (leave `bias_words` and its users unchanged)
- [x] T004 Remove `chart_points` from the backend: delete `chart_points()` and return only the additions from `final_scoring()` in `backend/linreg/scoring.py`; drop `"chart_points": points` and the `points` unpacking in `final_test` in `backend/linreg/nodes.py`; remove the `chart_points` field from `RunState` in `backend/linreg/state.py`
- [x] T005 Update the tests that expected it: `tests/test_reference_in_run.py` (replace the three `chart_points` tests with one asserting `final_test` emits no `chart_points` key and the state has none, keep the test that figures use unrounded predictions by computing from `final_scoring` directly), and any caller of `final_scoring` found in T001 (depends on T004)
- [x] T006 [P] Add the shared types in `web/src/page/final/types.ts`: `Fact`, `Block`, `CricketExplanation` (without `closing_lead`), `Figures` re-export, `FinalState` (the `final` fields the tab reads: `methods`, `accuracy`, `bias_phrases`, `winner`, `llm_took_part`); move nothing else yet
- [x] T007 Write the pure view in `web/src/page/final/view.ts` per [data-model.md](data-model.md): the README copy table keyed by method id (names and one-line descriptions), `rows(final)` sorted by `average_miss` ascending with ties in `final.methods` order, place numbers 1 to 4, `isChosen` (= `final.winner`), `isLeader`; header lead text builder taking test year and innings count from the `split` and `final.accuracy`
- [x] T008 [P] Vitest for the view in `web/tests/unit/final-view.test.ts`: ordering and place numbers on three figure sets, ties keep display order, three rows without the AI model, chosen flag follows `final.winner` (not the shortest bar), header lead uses the state's year and count (depends on T003, T007)
- [x] T009 Create the composer `web/src/page/final/index.ts` exporting `renderFinal(target, state)`: empty target when `final` is missing (the existing "not ready" sentence from feature 011 stays); otherwise the header (`h2` "The final test", lead, `data-testid="final-header"`, no eyebrow) then three `section`s `final-section-1..3` each with an `h3` "N. …" and a lead; no `details` elements; each section body comes from its module (stub until its story task lands)
- [x] T010 Wire it: change the import in `web/src/page/main.ts` to `./final`; delete `web/src/page/results.ts`, `web/src/page/accuracy.ts`, `web/src/page/accuracy-chart.ts` and `web/tests/unit/accuracy-chart.test.ts`; keep `cricket-terms.ts` until T031 moves its helpers (depends on T009)
- [x] T011 Add the shared CSS in `web/index.html`: section heading style (one style for the three `h3`, no eyebrow), lead text, tokens `--m-llm`, `--m-forward`, `--tv`, `--m-know-nothing`, `--win`/`--win-bg`, `--lose`/`--lose-bg`; remove the comparison box, `.accuracy-table`, scatter-plot and `.winner` rules that nothing else uses; stack at narrow widths; no animation

**Checkpoint**: the app builds; the final test tab shows the header and three numbered empty sections; the other tabs and the summary line work.

---

## Phase 3: User Story 1 - Say who won and whether the goal was reached (P1) 🎯 MVP

**Goal**: section 1 shows the ranked bars and the verdict line.
**Independent test**: for several figure sets the bars, places, pick note, axis and verdict variant match the state; the extra sentence appears only when another method has the strictly shortest bar.

### Backend: facts and verdict

- [x] T012 [US1] Add the facts used by the verdict to `backend/linreg/cricket_facts.py`: `chosen_label`, `race_leader`, `race_leader_label`, `race_leader_differs` (chosen model leads ties), `test_innings` and `know_nothing_miss`, each as `{value, unit, display, meaning}` per [data-model.md](data-model.md); read only from `final.accuracy`, `final.winner`, `final.methods`
- [x] T013 [US1] In `backend/linreg/cricket_blocks.py` add `CODE_ONLY = ("verdict", "rule_of_thumb")` and rewrite `_verdict` with the three variants (reached → tick; missed_beat → dash; missed_worse → cross), wording per the README, naming `{chosen_label}`, plus a second sentence only when `race_leader_differs` ("the {race_leader_label} had the shortest bar, but the choice was made before the test, as it must be"); `visual = {variant, shape, race_leader_differs}`; in this task change only `_verdict` and add the new constants, and leave `BLOCK_IDS`, `MOVABLE` and `build_blocks` as they are until T025 swaps the whole block set at once, so the suite stays green between tasks
- [x] T014 [P] [US1] pytest in `tests/test_cricket_blocks.py` and `tests/test_cricket_facts.py` (update the REQUIRED set): each verdict variant on at least three figure sets; the extra sentence present only when the race leader differs from the chosen model (rival shorter bar, TV shortest bar) and absent otherwise including an exact tie; `chosen_label` is "rival's model" when the AI model did not take part; every number in the verdict text equals a fact display (depends on T002, T012, T013)

### Front end: section 1

- [x] T015 [US1] Write `web/src/page/final/race.ts`: pure `scale(rows)` (max rounded up to the next 10, 10 when all zero), `ticks(max)` (0 and every 10), `barPercent(miss, max)`; and `renderRace(rows, verdictBlock | undefined, explanation)` building the lead (README wording with "average miss" and "Shorter bar = more accurate" in bold), one `race-row` per row (place label, method name and description in its colour, bar from zero with the value at its end; `race-pick` note on the chosen model's row; TV bar hatched with a CSS pattern, know-nothing bar grey), the axis (`race-axis`, `race-tick`, "runs off, on average"), and the verdict line from the verdict block (`verdict` with `data-variant`, `verdict-shape` tick, dash or cross, `--win` tint for reached and `--lose` otherwise, `verdict-leader` for the extra sentence); the verdict slot is absent when there is no explanation yet
- [x] T016 [US1] Hook `renderRace` into the composer in `web/src/page/final/index.ts` for section 1 and add the section 1 CSS in `web/index.html` (row grid, bar track, hatch pattern, axis, verdict line, place label larger for 1st; method name above its bar at narrow widths)
- [x] T017 [P] [US1] Vitest in `web/tests/unit/final-race.test.ts`: scale rounds up to the next 10 including an exact multiple and a zero case; bar percentages; ticks; ordering on three figure sets; the pick note is on `final.winner`, not on the shortest bar; the verdict element uses the variant's shape and tint; no verdict element without an explanation (depends on T003, T015)
- [x] T018 [US1] Playwright `web/tests/e2e/final.spec.ts` (fake model), section 1: three numbered sections and no `details`/`summary` in the tab; four `race-row` elements sorted by value ascending with the values equal to `final.accuracy[m].average_miss` read from the replay state; `race-pick` on the winner; TV bar has `data-hatched`; verdict `data-variant` for the three variants via crafted `final_test`/`explain` events (depends on T016)

**Checkpoint**: a visitor can say who won and whether the goal was reached.

---

## Phase 4: User Story 2 - See how close each method got (P1)

**Goal**: section 2 shows stacked closeness bars, bias in words and the closing line.
**Independent test**: shares add to 100 for every method on every figure set; words and bias match the state.

- [x] T019 [US2] Add the facts for section 2 to `backend/linreg/cricket_facts.py`: `share_within_10_words`, `leader_within_10`, `leader_within_10_words` using a fixed table `WITHIN_10_WORDS` (the boundaries in [research.md](research.md) §4) applied to the displayed one-decimal figure, and `tv_bias_large` (= `accuracy.is_large_bias` of the TV's figures); pytest in `tests/test_cricket_facts.py` covering every band edge (below, at and above each boundary) and `tv_bias_large` true/false (depends on T012)
- [x] T020 [US2] Write `web/src/page/final/closeness.ts`: pure `shares(within10, within20)` returning `[a, b - a, 100 - b]` from the whole-percent rounding of the displayed figures (with `b = max(a, b)`); `renderCloseness(rows, explanation)` with the lead, key (`close-key`: within 10 runs darkest, 10 to 20 middle, more than 20 lightest), one `close-row` per row in section 1's order with three `close-seg` (`data-band`, percentage printed inside; zero-width segments keep their label out of the bar), method name and `close-bias` (the server's `final.bias_phrases[m]`, shown as sent; `data-large` and TV colour emphasis from `tv_bias_large`, TV row only), and the closing line (`close-note`) built from `leader_within_10_words` plus the "No method can be perfect…" text, present once the explanation exists
- [x] T021 [US2] Hook `renderCloseness` into section 2 of the composer and add its CSS in `web/index.html` (stacked bar, three shades of `--text` via `color-mix`, percentages readable on each shade in both themes, name and bias above the bar at narrow widths) (depends on T020)
- [x] T022 [P] [US2] Vitest in `web/tests/unit/final-closeness.test.ts`: `shares` totals 100 for a generated grid of (within10, within20) pairs with `within20 >= within10`, including 0, 100, equal values, and .5 rounding; a three-row layout without the AI model; bias text is the `bias_phrases` entry as sent, for too low, too high and about right; TV emphasis only when `tv_bias_large`; no closing line without an explanation (depends on T003, T020)
- [x] T023 [US2] Playwright in `web/tests/e2e/final.spec.ts`: for each `close-row` the three printed percentages sum to 100 and equal the values derived from the state's `within_10`/`within_20`; bias text equals `final.bias_phrases[m]`; the closing line contains the leader's words from the facts (depends on T021)

---

## Phase 5: User Story 3 - Take away what it means in cricket terms (P1)

**Goal**: section 3 shows three takeaways and the rule of thumb, true to the figures, with the language model writing only the takeaways.
**Independent test**: every sentence is checked against at least three differing figure sets; model replies with digits or direction words are rejected.

### Backend

- [x] T024 [US3] Add the remaining facts to `backend/linreg/cricket_facts.py`: `tv_gap`, `run_rate_state` (`hero_text.barely_helps` first, then gap > 0 → "clearly", else "none"), `tv_bias_runs`, `tv_bias_direction` (value low/high/none, display "too low"/"too high"/"about right", using `accuracy_text.bias_short`'s zero test), `rule_verb` ("add" when the TV is too low, "take off" when too high, none when the bias is not large) and `rule_runs` (add only; the facts and `CLOSING_LEADS` that only the old blocks used are removed in T025, not here) (depends on T012, T019)
- [x] T025 [US3] In `backend/linreg/cricket_blocks.py` set `BLOCK_IDS = ("verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb")` and `MOVABLE = ()`, then write the three takeaway templates and the rule of thumb per [data-model.md](data-model.md): `takeaway_run_rate` (barely / clearly / none), `takeaway_drivers` (leads with the wicket cost when `wicket_cost` or `wicket_in_hand_value` exists, with the existing cautious wording for the odd sign; otherwise leads with `{biggest_factor}`; `visual = {rows (biggest first), wicket}`), `takeaway_tv` (low / high / none), `rule_of_thumb` (add or take off with `{rule_runs}`, plus the wicket clause when a wicket feature exists; wickets-only when the bias is not large; plain sentence when also no wicket feature; the wicket clause is worded separately for `wicket_cost` and for `wicket_in_hand_value` ("a bit more if wickets are in hand, a bit less if not"), each with its odd-sign case, and pytest covers all three: cost, in hand, none); remove `_how_chosen`, `_closing`, `_wicket`, the old `_drivers`, their purposes and `MAX_SENTENCES`, then (after a grep shows no other use) the facts only they used (`winner_validation_error`, `check_year_*`, `training_from`, `training_to`) and `CLOSING_LEADS` from `cricket_facts.py`; update the existing tests that name the old block ids in the same task so the suite is green when it ends; `BLOCK_PURPOSE` for the three takeaways only; all wording uses `{placeholders}` filled by `fill` (depends on T013, T024)
- [x] T026 [US3] In `backend/linreg/writing_reply.py` add `DIRECTION_WORDS` (the list in [contracts/final-test-tab.md](contracts/final-test-tab.md)) matched on whole words, case-insensitive, outside placeholders, in `_check_text` with a clear `UnusableReply` message that does not echo the model's text; remove `order` and `closing_lead` handling and the `CLOSING_LEADS` import; offered blocks are the ones in `available`
- [x] T027 [US3] In `backend/linreg/prompts.py` update `writing_schema`, `build_writing_system` and `build_writing_user` for takeaways only: no `order`, no `closing_lead`, no "closing block" sentence limit, an added rule that direction and verb words (too low, too high, add, take off, over, under) must come from placeholders such as `{tv_bias_direction}` and `{rule_verb}` and never be written; update `build_writing_request` signature accordingly
- [x] T028 [US3] In `backend/linreg/nodes.py` change `write_in_cricket_terms` to offer and parse only blocks not in `cricket_blocks.CODE_ONLY`, pass code-only blocks through unchanged (`from_model: []`), keep `explanation.order` fixed, drop `closing_lead` from `explain_in_cricket_terms` and the returned explanation, count `covered` over takeaways only, and keep every existing fallback (depends on T025, T026, T027)
- [x] T029 [US3] Update `backend/linreg/llm_fake.py`: `writing_reply` and the scripted reply cover the three takeaway ids using placeholders (including `{tv_bias_direction}`), drop `order` and `closing_lead` (depends on T025)
- [x] T030 [P] [US3] pytest for the backend of section 3, updating `tests/test_cricket_blocks.py`, `tests/test_cricket_facts.py`, `tests/test_writing_reply.py`, `tests/test_write_step.py`, `tests/test_explanation_numbers.py`, `tests/test_explanation_reference.py`, `tests/test_prompts.py` (and `tests/test_cricket_section_size.py` if T001 lists it): facts on the three figure sets (TV barely vs clearly better vs no better; bias too low, too high, small; with and without a wicket feature); each takeaway variant's text is true to its figures (e.g. "take off" and "too high" only when the TV is too high); the rule of thumb's verb and wording follow the bias; code-only blocks are never offered to the model and a reply naming them is ignored; replies are rejected for digits, number words and each direction word, including inside titles, and accepted when the direction comes via a placeholder; per-block fallback still works; every number in the section equals a fact display (depends on T002, T028, T029)

### Front end

- [x] T031 [US3] Write `web/src/page/final/takeaways.ts`: move `bars()`, `driversText()` and the diverging bar chart from `web/src/page/cricket-terms.ts` (biggest first, right for adds, left for costs, signed value labels, text equivalent table `drivers-table`); `renderTakeaways(explanation)` with the heading, the writer label (`writer-label`, `data-source`: "Written by <model> · every number from code" or "Template wording · every number from code"), three `takeaway` cards (`data-n`, "Takeaway N", headline, sentences, the drivers card with its chart and the wicket figure) stacked on a phone, and the dark `rule-of-thumb` banner; everything set as text; then delete `web/src/page/cricket-terms.ts` and its unit test (depends on T006)
- [x] T032 [US3] Hook `renderTakeaways` into section 3 of the composer (absent until the explanation exists) and add section 3 CSS in `web/index.html` (three columns to one, diverging bars with a zero line, signed labels, banner colours that work in both themes, no colour-only cue); remove the unused goal-badge, years-strip and wicket-figure CSS (depends on T031)
- [x] T033 [P] [US3] Vitest in `web/tests/unit/final-takeaways.test.ts` (move the `bars` and `driversText` cases from the old `cricket-terms.test.ts`): bars go right for adds and left for costs, biggest first, minimum width; single-sign charts; the label text for model-written and template sources; three cards in fixed order (depends on T003, T031)
- [x] T034 [US3] Playwright in `web/tests/e2e/final.spec.ts` (fake model): three `takeaway` cards and a `rule-of-thumb`; `writer-label` `data-source` is "language model" with the model name on an AI run and "template" otherwise; every number in section 3 appears in `explanation.facts` displays (depends on T032)

---

## Phase 6: User Story 4 - Language model does not take part (P2)

**Goal**: three rows everywhere and the rival named in the verdict.
**Independent test**: run with no language model and inspect the tab.

- [x] T035 [US4] Check that `race.ts`, `closeness.ts` and `takeaways.ts` read their rows from `final.methods` only (no hard-coded four) and that `chosen_label` drives the verdict; fix anywhere a four-row assumption remains (depends on T018, T023, T034)
- [x] T036 [P] [US4] Playwright in `web/tests/e2e/final.spec.ts`: a run without the AI model shows three `race-row` and three `close-row`, no row for the AI's model, a verdict naming "rival's model", the template label, and takeaways based on the rival's features (depends on T035)

---

## Phase 7: User Story 5 - Tab before the final test (P3)

**Goal**: the existing "not ready" sentence shows before the final test step.
**Independent test**: step back to before `final_test`.

- [x] T037 [P] [US5] Playwright in `web/tests/e2e/final.spec.ts`: stepping to before `final_test` shows the "not ready" sentence and none of `final-section-1..3`; at `final_test` sections 1 and 2 appear and the verdict, closing line and section 3 are absent; one step later they appear (depends on T021, T032)

---

## Phase 8: Polish & cross-cutting

- [x] T038 Update the e2e specs that touched removed parts, changing only those assertions: `web/tests/e2e/cricket-terms.spec.ts`, `explanation.spec.ts`, `reference.spec.ts` (drop the `chart_points` row and scatter-plot checks; keep the hero and accuracy-figure checks that still apply), `tabs.spec.ts`, `llm-run.spec.ts`; delete assertions for `comparison`, `accuracy-table`, `cricket-block`, `writer-fallback` where they no longer exist; keep everything else (depends on T001, T032)
- [x] T039 Playwright in `web/tests/e2e/final.spec.ts`: light and dark render (emulated colour scheme, bars and percentages visible, text contrast via computed colours not equal to background); no sideways scroll at 360 px (`document.documentElement.scrollWidth <= 360`); no CSS animation or transition on the tab's elements; methods distinguishable without colour (each bar has a name label, the TV bar has `data-hatched`, the verdict has a shape)
- [x] T040 Playwright "every number equals the run state" check in `web/tests/e2e/final.spec.ts`: collect every number on the tab text, and assert each is derived from the replay state (`final.accuracy`, `explanation.facts`, `split`) or is a README fixed number (the 10-run gridline steps, "10", "20", section numbers and takeaway numbers) (depends on T018, T023, T034)
- [x] T041 Full verification: `python -m pytest` in `apps/linear_regression`, `npm run test`, `npm run build` and `npx playwright test` in `web`; confirm the other tabs, the graph and the live summary line are unchanged (existing tests for them pass untouched); grep the repo for stale references (`chart_points`, `how_chosen`, `closing_lead`, `cricket-terms`, `accuracy-chart`, `renderAccuracy`, `finalComparison`) and fix any
- [ ] T042 Walk through [quickstart.md](quickstart.md) in a browser: replay to `final_test` and one step on, check light and dark and a 360 px window, and mark the manual success criteria SC-001 (a few seconds to say who won, whether the goal was reached and one takeaway) for a person to judge

---

## Dependencies

- Phase 1 → Phase 2 → stories. T004–T005 (backend `chart_points`) are independent of T006–T011 (front end) and can run in parallel.
- **US1** (T012–T018) is the MVP and needs only Phase 2. **US2** (T019–T023) needs T012 for shared facts and T016 for the composer wiring. **US3** (T024–T034) needs T013 and T019; its backend tasks (T024–T030) can run alongside US2's front end. **US4** and **US5** are checks over the earlier stories.
- Within each story: facts → blocks → prompt/reply/node → front-end module → CSS → tests.
- T031 removes `cricket-terms.ts`; T038 follows it.

## Parallel opportunities

- T002, T003 and T006 (different files); T004/T005 alongside T007–T011.
- T014, T017, T022, T030, T033 are test-only tasks on separate files once their code lands.
- US2's front end (T020–T022) alongside US3's backend (T024–T030).

## Implementation strategy

1. **MVP** = Phases 1, 2 and 3: the ranked bars with the verdict line answer "who won and was the goal reached".
2. Add US2 (closeness), then US3 (takeaways and rule of thumb, the language-model work), then the US4/US5 checks and polish.
3. After each phase run the pytest and Vitest suites; run Playwright at the end of each story.
