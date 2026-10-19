# Tasks: Validation versus Test: Making the Two Tabs Agree

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/exam-tabs.md](contracts/exam-tabs.md), [research.md](research.md), [design/README.md](design/README.md) (authoritative for copy and layout; the two HTML files are pictures only)
**Tests**: requested in the planning brief (pytest, Vitest on pure functions, Playwright with the fake model; no test calls a real model).
**Paths**: all relative to `apps/linear_regression/` unless stated. Run Python with `../../.venv/Scripts/python`.
**Copy rule**: "candidate model", never "setup"; never the word "winner" in visible text.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US9 from the spec

---

## Phase 1: Setup

- [x] T001 Read the code and tests this feature touches and list in a scratch note which existing tests need updating: `web/src/page/found/{index,view,seasons,race,race-layout,contest,grid,ranking}.ts`, `web/src/page/final/{index,view,race,closeness,takeaways,types}.ts`, `web/index.html`, `backend/linreg/{cricket_facts,cricket_blocks,prompts,llm_fake}.py`; grep `tests/` and `web/tests/` for `winner-panel`, `winner-`, `winnerView`, `WinnerView`, `placeLabel`, `data-place`, `verdict-leader`, `race_leader`, `leader_within_10`, `closingText`, `final-section-2`, `final-section-3`, `"winner"` and `reason` so every test to change is known before editing
- [x] T002 [P] Extend the fixtures in `web/tests/unit/final-fixtures.ts`: `finalState` gains `validation_mae` (`{llm, forward}`) and a `designRun` state with exactly validation rival 17.0 / AI 17.4 and test AI 17.7 / rival 17.8 (TV 21.4, know-nothing 34.5); add `examState(opts)` returning a full run-state object (`split` with checks 2023 to 2025 and test 2026, `attempts` with N AI fitted attempts, a `grid` with M allowed cells and some not allowed, `final`, `validation_winner`); add three named figure sets (AI ahead on both exams, rival ahead on both, split by exam) plus gap variants 0.49, 0.5 and 1.2
- [x] T003 [P] Extend `state_for` in `tests/test_explanation_numbers.py` with `know_nothing_bias` (default 0.0, so existing tests are unchanged) feeding `accuracy["know_nothing"]["bias"]`

---

## Phase 2: Foundational (blocks all user stories)

- [x] T004 Create the shared module `web/src/page/exam.ts` per [data-model.md](data-model.md): `TOO_CLOSE_RUNS = 0.5` (the only definition), `tenths`, `fromTenths` and `shown` (moved from `found/view.ts`, which re-exports them so existing imports keep working), `tooClose(a, b)` comparing integer tenths (`|tenths(a) − tenths(b)| < TOO_CLOSE_RUNS * 10`), `examYears(split)` (check years list, first, last, test year), `examPill(exam)` and `examBanner(exam, ...content)` building the pill (text "VALIDATION" or "TEST", `data-testid="exam-pill"`, `data-exam`) and the full-width banner (`data-testid="exam-banner"`, `data-exam`)
- [x] T005 [P] Vitest `web/tests/unit/exam.test.ts`: `tooClose` at gaps 0.49 (true), 0.5 (false), 1.2 (false) and 0 (true), symmetric in its arguments, correct for values like 17.8 and 17.3 (floating point), using displayed rounding (17.84 vs 17.35 compare as 17.8 vs 17.4); `examYears` from a split with three checks and with one; a source check that `TOO_CLOSE_RUNS` is defined exactly once under `web/src` and that no file under `backend/` mentions a too-close threshold (read the files with `node:fs`) (depends on T004)
- [x] T006 [P] Add the styles in `web/index.html`: tokens `--val` (light `#a35d00`, dark a lighter amber), `--val-bg` (light `#fdf6e7`, dark a deep amber), their text colours chosen so every pill and panel text keeps 4.5:1 in both themes; `.exam-pill` (VALIDATION amber fill with white text in light mode; TEST fill `var(--text)` with `var(--bg)` text), `.exam-banner` (full width, flex-wrap so the text wraps under the pill at 360 px, amber outline and pale fill for validation, dark fill for test), `.exam-validation` for check-season segments; remove nothing yet; nothing animates
- [x] T007 Rename the choice panel's structure from `winner` to `choice` without changing behaviour yet: in `web/src/page/found/race.ts` rename `renderWinnerPanel` to `renderChoicePanel`, the test id `winner-panel` to `choice-panel`, the classes `winner-*` to `choice-*`; update the CSS rules in `web/index.html` and the tests that name them (`web/tests/e2e/found.spec.ts`, `web/tests/e2e/tabs.spec.ts`, `web/tests/e2e/llm-run.spec.ts`); keep every visible word as it is for now (depends on T001)

**Checkpoint**: the app builds; `exam.ts` and its tests pass; the found tab looks as before; the new CSS exists but nothing uses it yet.

---

## Phase 3: User Story 5 - Too close to call (P1)

**Goal**: one rule, decided in the browser, used wherever two models are compared on one exam.
**Independent test**: `choiceView` and the final-tab sentences read "too close to call" for 0.49 and not for 0.5 or 1.2, on both exams.

- [x] T008 [US5] In `web/src/page/found/view.ts` replace `WinnerView` and `winnerView` with `ChoiceView` and `choiceView(w, ai, rival)` per [data-model.md](data-model.md): states `pending`, `clear`, `whisker` (gap under 5 tenths, including a tie and a displayed tie recorded as the rival's), `noAi` (rival goes forward, no comparison, `tooClose` false); the recorded `validation_winner` is never overridden; add the pure copy `choiceHeading(v)` ("The AI agent's candidate model" or "The rival's candidate model", plus ", by a whisker" when too close) and `choiceText(v)` (the README's sentences: both scores "on the check seasons", then "A gap of <gap> runs is too close to call: the two are about equally good." or "<gap> runs better.", then, only when too close, "A choice still has to be made, so the lower score goes forward. How good it really is gets settled by the final test, on a season nothing has seen."); `buildView` returns `choice` (renamed from `winner`); in the same task update the one caller, `renderChoicePanel` in `web/src/page/found/race.ts` (and `raceText` if it reads the old field), to read `view.choice` with the old wording unchanged until T020, so the build stays green (depends on T004, T007)
- [x] T009 [P] [US5] Vitest `web/tests/unit/found-choice.test.ts` (and update `web/tests/unit/found-view.test.ts` where it used `winnerView`): the design run (rival 17.0, AI 17.4) is `whisker` with gap 0.4; gaps 0.49 whisker, 0.5 clear, 1.2 clear; both directions (AI chosen, rival chosen); tie goes to the AI as `whisker`; a displayed tie recorded as the rival's is `whisker` and the rival is still chosen; no AI score is `noAi` with no gap and `tooClose` false; no decision yet is `pending`; `choiceText` contains "too close to call" only for `whisker` and never otherwise; at least three differing figure sets for each sentence (depends on T008)
- [x] T010 [US5] Add the final-tab pure copy in `web/src/page/final/copy.ts` per [data-model.md](data-model.md): `ahead(scores)` returning `ai`, `rival`, `close` or undefined; `compareSentence(view)` (under the bars: "too close to call" when the AI and the rival are within the threshold on the test, otherwise which was more accurate and by how many runs, then whether both beat the TV projection and the know-nothing guess, from displayed test misses; empty without the AI's model); `leadSentence(view)` ("On the check seasons the rival was ahead; on <year> the AI edged it." and its variants for ahead on both, ahead on one, close on one or both); `bothTiny(view)` ("Both gaps are tiny." only when both gaps are under the threshold); `reasonTwo(view)` ("<n> candidate models were tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh data."); `scaleMax(view)`; and `examView(state)` in `web/src/page/final/view.ts` building `ExamView` from `final.validation_mae`, `final.accuracy`, `final.llm_took_part`, `final.winner`, `split`, and the candidate-model count (AI fitted attempts plus grid cells with `allowed`) (depends on T004)
- [x] T011 [P] [US5] Vitest `web/tests/unit/final-copy.test.ts`: for at least three differing figure sets (AI ahead on both exams, rival ahead on both, split by exam) assert `leadSentence` names the right leader on each exam and uses "edged" only for gaps under the threshold; gap variants 0.49, 0.5 and 1.2 on each exam for `ahead`, `compareSentence` and `bothTiny` (including one exam tiny and the other not, which never says "Both gaps are tiny."); `compareSentence` says whether both beat the TV and the know-nothing guess and is correct when one or neither does; `reasonTwo` shows the count from the state (0, 1, 24 and 31 models) and never a typed word such as "dozens"; without the AI's model every comparison is empty and no text contains "too close to call"; no output contains "winner" (depends on T002, T010)

**Checkpoint**: the rule and every sentence it drives are tested with numbers alone.

---

## Phase 4: User Story 1 - Tell which exam every score comes from (P1)

**Goal**: both tabs carry a banner and exam labels, and the word "winner" is gone from visible text.
**Independent test**: Playwright reads both tabs' banners, pills and score labels, and fails on the word "winner".

- [x] T012 [US1] What the agent found: in `web/src/page/found/index.ts` add the VALIDATION banner under the lead using `examBanner("validation", ...)` with text "Every score on this tab comes from the check seasons, <first>–<last> (cross-validation). They are used to choose a candidate model, not to judge it. The honest verdict comes from the final test." (years from `examYears(split)`; no banner text before `split` exists); update the section headings it builds (section 2 and 3 headings are finished in their own tasks)
- [x] T013 [US1] The final test: in `web/src/page/final/index.ts` replace the old header lead with the README's lead ("For each of the <n> innings of <year>, four predictions of the final total, made at the halfway mark and then compared with what really happened.", "three" without the AI's model) via the new `headerLead` in `web/src/page/final/view.ts`, and add the TEST banner under it: "Every score on this tab comes from <year>, a season that was never used for learning, tuning or choosing. These are the honest numbers."; leave `PLACES`, `placeLabel` and `Row.place` in place for now (`final/race.ts` still uses them; T025 removes them together with their last use, so the build stays green) (depends on T004)
- [x] T014 [US1] Remove the last visible "winner": in `web/src/page/final/closeness.ts` the closing line becomes "Even our pick…" (the README's wording; a deliberate small extension: "Our pick…" instead when the share is high, because "Even" reads wrongly then) and reads the chosen model's within-10 words (`share_within_10_words` and `within_runs_threshold` facts) instead of the race leader's; in `backend/linreg/cricket_facts.py` drop `race_leader`, `race_leader_label`, `race_leader_differs`, `leader_within_10`, `leader_within_10_words` and reword every fact `meaning` that says "winner" to "chosen candidate model"; in `backend/linreg/cricket_blocks.py` drop the verdict's extra sentence and `visual.race_leader_differs`; drop `winner_name` if no template uses it (depends on T013)
- [x] T015 [P] [US1] Update the Python tests for T014: in `tests/test_cricket_blocks.py` remove the extra-sentence tests (`test_the_extra_sentence_appears_only_when…`, `test_no_extra_sentence…`) and the `race_leader_differs` visual assertions, and assert the verdict has exactly one sentence for every figure set; in `tests/test_cricket_facts.py` remove the race-leader and leader-share tests, update the `REQUIRED` and `GONE` sets (drop the five removed fact ids from `REQUIRED`, add them to `GONE`, and drop `winner_name` from `REQUIRED` if T014 removed it), and assert no fact `meaning` contains "winner"; keep the verdict variant, label and no-AI tests (depends on T014)
- [x] T016 [P] [US1] Update `web/tests/unit/final-race.test.ts`, `web/tests/unit/final-closeness.test.ts` and `web/tests/unit/final-fixtures.ts` for the removed place labels and the new closing wording (the "Even our pick" and "Our pick" variants; no "winner")
- [x] T017 [US1] Playwright in `web/tests/e2e/final.spec.ts` and `web/tests/e2e/found.spec.ts`: each tab shows one `exam-banner` with its `exam-pill` (`data-exam` validation on found, test on final) directly under its lead and as wide as the container; the banner text contains the years from the run's `split`; the visible text of both tabs never contains "winner" (case-insensitive) for an AI run, a no-AI run (the "Unreliable" model) and a run where the pick lost the test (crafted state whose test scores favour the other model); add a shared helper in `web/tests/e2e/helpers.ts` (`visibleText(page, testid)`) (depends on T012, T013, T014)

**Checkpoint**: both tabs say which exam they show and never say "winner".

---

## Phase 5: User Story 2 - What the check seasons are for (P1)

**Goal**: What the agent found explains that the check seasons choose, with a "Chosen on validation" panel.
**Independent test**: compare every heading, caption and the panel with the README and the run's state.

- [x] T018 [US2] Section 2 in `web/src/page/found/seasons.ts` and `web/src/page/found/index.ts`: heading "2. How every candidate model is scored: three check seasons (cross-validation)"; the lead adds "These scores are used again and again to compare candidate models, which is exactly why they can't also be the final verdict."; the check-season segments take class `exam-validation` (validation outline and fill) and the test segment the test outline; under the strip a caption row `season-caption` with `season-caption-validation` "VALIDATION: USED TO CHOOSE" and `season-caption-test` "TEST" (depends on T006)
- [x] T019 [US2] Section 3 in `web/src/page/found/index.ts`, `web/src/page/found/race.ts` and `web/src/page/found/race-layout.ts`: heading "3. The race on the check seasons"; the chart's y-axis label "average miss on check seasons"; the caption ends "All scores are on the check seasons."; the end labels and the visually hidden `race-text` say "on the check seasons"; update the text equivalent in `raceText` to match (depends on T008)
- [x] T020 [US2] The choice panel in `web/src/page/found/race.ts` (and CSS in `web/index.html`): label "Chosen on validation"; heading from `choiceHeading`; text from `choiceText`; the link `to-final` to The final test; left border in the chosen method's colour (`--m-llm` or `--m-forward`); three states `clear`, `whisker`, `noAi` plus `pending` ("Still searching…" wording kept, no "winner"); `data-state` carries the `ChoiceView` state; the element with the phrase "too close to call" carries `data-testid="too-close"` (depends on T008, T019)
- [x] T021 [US2] Sections 5 and 6 score labels: in `web/src/page/found/grid.ts` the best-cell line says "on the check seasons" (for example "★ The rival's best: <score> on the check seasons"); in `web/src/page/found/ranking.ts` the column heading becomes "Average miss on check seasons (runs)" and the TV line says "on the check seasons"; check `web/src/page/found/contest.ts` for any "winner" or unlabeled score and fix it
- [x] T022 [P] [US2] Update `web/tests/unit/found-view.test.ts` and `web/tests/unit/found-race.test.ts` where they asserted the old chart caption, axis label or panel wording
- [x] T023 [US2] Playwright in `web/tests/e2e/found.spec.ts`: section 2 heading ends "(cross-validation)", its lead contains "used again and again", the caption row holds both captions, the check segments have the validation class; section 3 heading, axis label and caption per the README; `choice-panel` shows "Chosen on validation", the scores from `validation_winner`/`attempts`/`forward_best`, a `data-state`, and a working link to The final test; grid best line and ranking heading say "on the check seasons"; every score on the tab sits in a labelled element (a test that walks each `[data-testid=choice-panel], [data-testid=grid-best], [data-testid=ranking]` and checks the label text) (depends on T018 to T021)

**Checkpoint**: the found tab is labelled end to end and reads as a choice, not a verdict.

---

## Phase 6: User Story 3 - How did our pick do? (P1)

**Goal**: The final test section 1 leads with our pick beside the goal verdict.
**Independent test**: compare the card, bars and sentence with the run's accuracy figures for three differing sets.

- [x] T024 [US3] Create `web/src/page/final/pick.ts`: `renderPick(row, years, verdictBlock)` building the large card in the chosen method's colour ("Our pick: the <chosen>'s model", its test miss as the big figure (`pick-miss`) with "runs off, on average", and "Chosen on the check seasons, before <test year> was touched.") and, beside it, the goal verdict card from the explanation's verdict block (feature 015's three variants and wording, unchanged; absent until the explanation exists) (depends on T013)
- [x] T025 [US3] In `web/src/page/final/race.ts` and `web/src/page/final/index.ts`: section 1 heading "1. How did our pick do?"; lead "All four predictions on <test year>. Shorter bar = more accurate." (three without the AI's model); remove the place column and `data-place`, and remove `PLACES`, `placeLabel` and `Row.place`/`Row.placeLabel` from `web/src/page/final/view.ts` in the same task; the chosen model's row keeps the outlined "our pick" tag; bars stay in test-miss order; add `compare-line` under the bars from `compareSentence`, rendered only when non-empty and with `data-testid="too-close"` on the phrase when it says so; remove `verdict-leader` and the extra-sentence code (depends on T010, T013, T024)
- [x] T026 [US3] Update the section 1 styles in `web/index.html`: `.pick-card` and the verdict card side by side, stacked at 360 px; remove the `.race-place` and `.race-first` rules and the grid column for the place label so the name and bar use the width; keep the outlined `.race-pick` tag legible in both themes
- [x] T027 [US3] Playwright in `web/tests/e2e/final.spec.ts`: update the section 1 tests (`race-row` has no `data-place`, the order is still ascending by value, `race-pick` is on `final.winner`'s row only); add: `pick-card` shows the chosen model's test miss from `final.accuracy` and the "Chosen on the check seasons, before <year> was touched." line; the verdict card beside it keeps its three variants; `compare-line` for the design run (AI 17.7, rival 17.8) says "too close to call", for a 1.2-run gap names the more accurate model and the gap, and never says "too close to call" at 0.5; the card and the verdict stack at 360 px (depends on T025, T026)

**Checkpoint**: The final test opens with our pick and a sentence that does not over-read small gaps.

---

## Phase 7: User Story 4 - Why the scores differ (P1)

**Goal**: new section 2 explains the difference using the run's own figures.
**Independent test**: every figure in the section matches the state for three differing figure sets.

- [x] T028 [US4] Create `web/src/page/final/differ.ts`: `renderDiffer(view)` building the lead ("The same two models, sat in two different exams." plus `leadSentence` and `bothTiny`), two cards side by side on one shared scale from zero (`exam-card` with `data-exam`: a VALIDATION card "Check seasons <years>", "Used to choose. Seen many times while comparing candidate models." and a TEST card "Final test <year>", "Used once, to judge. Never seen before.", each with an `exam-bar` and `exam-value` for the rival and the AI, one `exam-scale` axis shared by both), and three reasons (`reasons` holding `reason` with `data-reason` seasons, flatters, clean): "Different seasons", "Choosing flatters the pick" (text from `reasonTwo`, the count in `reason-count`), "The test is the clean one" ("<test year> played no part in learning, tuning or choosing, so nothing was fitted to it. When the two disagree, trust the test."); the section is built from `examView` and appears at the `final_test` step (depends on T010, T013)
- [x] T029 [US4] Renumber and reword in `web/src/page/final/index.ts`, `closeness.ts` and `takeaways.ts`: insert section 2 "2. Why the scores differ from What the agent found" between the race and closeness sections; "How close did each one get?" becomes section 3 (`final-section-3`) and its lead says "Every <test year> innings sorted by how far off the prediction was…"; takeaways become section 4 "4. In cricket terms: what this tells us" (`final-section-4`) (depends on T014, T028)
- [x] T030 [US4] Styles in `web/index.html` for the two cards (`.differ`, `.exam-card` with the validation outline and fill on the first and the dark fill on the second, bars sharing one axis, values printed at the bar ends, labels in words), the three reasons (`.reasons` a row on desktop, stacked at 360 px) and the shared-scale axis; text contrast 4.5:1 in both themes; nothing animates
- [x] T031 [P] [US4] Update `web/tests/unit/final-closeness.test.ts` and any `final-section-2`/`final-section-3` expectations for the renumbering (the closing line is already covered by T016)
- [x] T032 [US4] Playwright in `web/tests/e2e/final.spec.ts`: four numbered sections in order (`final-section-1` to `final-section-4`, headings as the README, none collapsible); section 2 holds a VALIDATION card and a TEST card with scores equal to `final.validation_mae` and `final.accuracy` read from the state panel, bars on one shared scale (the same pixel width means the same score), the three `reason`s in order, and `reason-count` equal to the AI's fitted attempts plus the grid's allowed cells from the state; for the design run `differ-lead` says the rival was ahead on the check seasons and the AI edged it on the test, and "Both gaps are tiny."; for a crafted run with a 1.2-run gap on one exam it does not say "Both gaps are tiny."; the section 2 figures appear at the `final_test` step and the verdict card and section 4 one step later (depends on T028 to T030)

**Checkpoint**: the contradiction between the tabs is explained with figures from the same run.

---

## Phase 8: User Story 9 - Without the language model (P2)

**Goal**: one model only, no too-close wording, the rival named.
**Independent test**: run with the "Unreliable" model and read both tabs.

- [x] T033 [US9] Check and fix the no-AI paths: `examView` sets `aiTook` false when `final.llm_took_part` is false or either AI score is missing; `renderDiffer` shows the rival's validation and test scores alone, keeps the three reasons and omits the comparison and "who was ahead" sentences; `compareSentence` and `leadSentence` return empty; the choice panel is `noAi`; no `too-close` element exists on either tab; the pick card names "the rival's model" (depends on T020, T025, T028)
- [x] T034 [P] [US9] Playwright in `web/tests/e2e/final.spec.ts` and `web/tests/e2e/found.spec.ts` (and update the no-AI assertions in `web/tests/e2e/llm-run.spec.ts`): with the "Unreliable" model the found tab's `choice-panel` is `data-state="noAi"` naming the rival, the final tab has three `race-row`, section 2 shows exactly one score per card, the three reasons remain, there is no `compare-line`, and `too-close` is absent from both tabs; a vocabulary check that "winner" is absent (depends on T033)

---

## Phase 9: User Story 6 - Takeaway 1 handles rising totals (P2)

**Goal**: takeaway 1 says "Scores keep climbing" when the know-nothing guess is far off because totals have risen.
**Independent test**: pytest on the variants for several figure sets.

- [x] T035 [US6] In `backend/linreg/cricket_facts.py` (`_reference_facts`) add `know_nothing_rising` (existing `is_large_bias` on the know-nothing figures and bias < 0), `know_nothing_bias_runs` and `know_nothing_bias_direction` (value low/high/none, display "too low"/"too high"/"about right", the same zero test as the TV's `accuracy_text.bias_short`), each with a `meaning` for the language model; no new threshold
- [x] T036 [US6] In `backend/linreg/cricket_blocks.py` `_takeaway_run_rate` add the "rising" variant (applies when `know_nothing_rising` is yes and `run_rate_state` is not `none`): title "Scores keep climbing", sentence within the 130-character limit built only from placeholders, for example "Totals keep rising: the average-total guess is {know_nothing_bias_runs} runs {know_nothing_bias_direction}, so beating it says less. The TV misses by {tv_test_miss} against {know_nothing_miss}."; keep feature 015's wording for every other case (depends on T035)
- [x] T037 [P] [US6] pytest in `tests/test_cricket_facts.py` and `tests/test_cricket_blocks.py`: for at least three differing figure sets assert `know_nothing_rising` and the variant: know-nothing far off and too low with the TV clearly better (rising, title "Scores keep climbing"), the same with the TV barely better (rising), too low but not large (not rising), far off but too high (not rising, and no sentence says totals rise), far off and too low but the TV no better (feature 015 wording); the rising sentence's numbers equal fact displays, its template is within `MAX_TITLE` and `MAX_SENTENCE`, and `check_section_numbers` passes; direction words appear only through placeholders (the template contains `{know_nothing_bias_direction}`); `tests/test_writing_reply.py` and `tests/test_write_step.py` still pass with the new fact ids offered to the model (add a scripted reply using `{know_nothing_bias_direction}`) (depends on T003, T036)

---

## Phase 10: User Story 7 - Plain cricket reasons (P2)

**Goal**: the AI's reasons are asked for in plain cricket words with no figures, column names or ids.
**Independent test**: a test on the prompt text.

- [x] T038 [US7] In `backend/linreg/prompts.py` change the `"reason"` instruction in `build_system` to ask for one or two sentences in plain cricket words, with no figures and no column names, and add one rule to the numbered rules saying feature ids and menu ids must not appear in the reason; leave the reply schema and everything else unchanged
- [x] T039 [P] [US7] pytest in `tests/test_prompts.py`: the system prompt asks for plain cricket words, no figures and no column names, and says ids must not appear in the reason; the example reason in the reply-shape line contains no digit and none of the catalogue's feature ids or menu ids; the prompt still lists the catalogue and menus; `llm_fake` still answers every proposal (run `tests/test_agent_run.py`); no test constructs a real client and `tests/test_key_never_leaks.py` still passes (depends on T038)

---

## Phase 11: User Story 8 - Leads at the full width (P3)

**Goal**: the leads run the full width of the container (the CSS change is already in the working tree).
**Independent test**: measure the lead against its container.

- [x] T040 [US8] Confirm the full-width rules in `web/index.html` (`.found-lead` and `.final-header-lead` have no `max-width`) and that no new rule from this feature reintroduces one; Playwright in `web/tests/e2e/found.spec.ts` and `web/tests/e2e/final.spec.ts`: at 1200 px the lead's width (`getBoundingClientRect`) equals its container's within 1 px for both tabs

---

## Phase 12: Polish and cross-cutting

- [x] T041 Playwright in `web/tests/e2e/final.spec.ts` and `web/tests/e2e/found.spec.ts`: no sideways scroll at 360 px on both tabs (`document.documentElement.scrollWidth <= 360`), the banners wrap under their pills (the pill's bottom is above the text's top, or on one line when it fits), the two exam cards and the three reasons stack (their tops differ), the pick and verdict cards stack; nothing on either tab animates (`getAnimations` empty, transition durations 0)
- [x] T042 Playwright contrast test in `web/tests/e2e/final.spec.ts` and `web/tests/e2e/found.spec.ts`: in light and dark, compute the contrast ratio from each element's computed text colour and its effective background (walking up to the first opaque background) for `exam-pill` (both exams), `exam-banner`, `pick-card`, `exam-card` (both), each `reason`, `choice-panel`, `compare-line` and the season caption row, and assert each is at least 4.5:1; if a value fails, adjust `--val`, `--val-bg` or their dark values in `web/index.html` until it passes
- [x] T043 Playwright "every number matches the run" in `web/tests/e2e/final.spec.ts` and `web/tests/e2e/found.spec.ts`: update the existing number checks for the new sections (the pick card, section 2 figures and `reason-count`, the choice panel scores and gap); the scan of numeric tokens on The final test allows only figures derived from `final`, `final.validation_mae`, `explanation.facts`, `split` and the counts; no number is a typed constant
- [x] T044 Update the remaining existing specs only where they checked wording or structure this feature changes: `web/tests/e2e/found.spec.ts`, `web/tests/e2e/final.spec.ts`, `web/tests/e2e/llm-run.spec.ts`, `web/tests/e2e/tabs.spec.ts` (the `winner-panel` id is already renamed in T007; update expectations that named `final-section-2` or `final-section-3` or section 2 and 3 headings), `web/tests/e2e/explanation.spec.ts` (the verdict-leader test becomes a test that no such sentence exists) and the cricket README paragraphs in `README.md` that describe the winner panel or section numbers (depends on T020, T029)
- [x] T045 Full verification: `../../.venv/Scripts/python -m pytest` in `apps/linear_regression`, then in `web/` `npm run test`, `npm run build` and `npx playwright test`; confirm the other tabs, the graph and the live summary line are unchanged (their tests pass untouched); grep `web/src` and `backend/` for stale references (`winnerView`, `WinnerView`, `renderWinnerPanel`, `winner-panel`, `placeLabel`, `race_leader`, `leader_within_10`, `verdict-leader`) and for the word "setup" in visible strings of the files this feature changed (not code names such as `setup.ts` or `setupHero`), and that `TOO_CLOSE_RUNS` appears once; confirm no file under `backend/` contains the too-close threshold
- [ ] T046 Walk through [quickstart.md](quickstart.md) in a browser: replay to the end, open both tabs in light and dark and at 360 px, and mark the manual success criteria SC-001 (which exam every score comes from, judged by a person) for a person to judge

---

## Dependencies

- Phase 1 → Phase 2 → stories. T004 (`exam.ts`) blocks every story; T006 (styles) blocks T018, T026, T030.
- **US5** (T008–T011) is the base for US2, US3 and US4 (the rule and the sentences). **US1** needs T004 and T013. **US2** needs US5's `choiceView`. **US3** needs T010 and T013. **US4** needs T010 and T013 and renumbers after T014. **US9** follows US2, US3 and US4. **US6**, **US7** and **US8** are independent of the front end and can run any time after Phase 2 (US6 needs T003).
- Within each story: pure functions and their tests → renderers → styles → Playwright.
- T014 (dropping facts and the verdict sentence) must land together with T015 so the suite is green.

## Parallel opportunities

- T002, T003 and T006 are different files; T005, T009, T011, T015, T016, T022, T031, T034, T037 and T039 are test-only tasks on separate files once their code lands.
- The backend stories (US6: T035–T037, US7: T038–T039) can run alongside any front-end story.
- US2's front end (T018–T021) alongside US3's pure copy (T010–T011) once T008 is done.

## Implementation strategy

1. **MVP** = Phases 1, 2, 3 and 4: the shared rule, both banners and labels, and no "winner" anywhere. That alone removes the apparent contradiction.
2. Add US2 (the choice panel and found-tab headings), then US3 (our pick) and US4 (why the scores differ), then US9, US6, US7 and US8, then polish.
3. After each phase run pytest and Vitest; run Playwright at the end of each story. The full Playwright suite takes about two minutes on this machine when run alone.
