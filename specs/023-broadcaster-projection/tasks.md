# Tasks: The Broadcaster's Projected Score

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md), [design/README.md](design/README.md)
**Tests**: Requested by the plan (updated fixtures and assertions, new banned-term, reply-check, no-literal-TV and examples-table tests), so test tasks are included.

Paths are relative to the repo root. `APP` = `apps/linear_regression`; `BE` = `APP/backend/linreg`; `WEB` = `APP/web`; `PG` = `WEB/src/page`; `E2E` = `WEB/tests/e2e`; `UNIT` = `WEB/tests/unit`; `FIX` = `WEB/tests/fixtures`; `PYT` = `APP/tests`.

**Format**: `- [ ] T### [P?] [Story?] Description with file path`. `[P]` = different files, no dependency on an unfinished task.

**Rules for every task**: wording only. Never rename an identifier (term id `tv`, method id `broadcaster`, fact names `tv_*`, CSS classes `tv-*`, test ids `tv-*` and `tryit-tv`, the `--tv` colour token, state keys, `data-figure` keys). Never add "'s" in code: use the long form (`term('tv')`, "broadcaster's projection") or the short form (`short('tv')`, "the broadcaster") from the glossary. The agent's quoted reasoning is never changed.

**Stories** (from the spec):
- **US1** (P1) A sharper question on first sight: hero h1 and lead, page title and preview tags, phone first screen
- **US2** (P1) One name for the yardstick, everywhere: every sentence, label, chart text and aria-label
- **US3** (P2) The name stays fixed and a live model uses it: reword prompt example, banned list, no-literal-TV guards

---

## Phase 1: Setup

- [x] T001 Run all suites (`pytest` in `APP`; `npx tsc --noEmit`, `npx vitest run` and `npx playwright test` in `WEB`) and confirm they are green on `a166173` before any change; note any failure in `specs/023-broadcaster-projection/quickstart.md`
- [x] T002 Measure the phone baseline: with the 022 build open `/` at 390 × 664 and record the h1 height and the Start button's bottom edge in `specs/023-broadcaster-projection/research.md` under R5 (before the h1 changes)

---

## Phase 2: Foundational (blocks every story): the term list

- [x] T003 In `BE/methods.py` add `short: str | None = None` and `short_possessive: str | None = None` to `Term`; change the `tv` term to plain "broadcaster's projection", short "the broadcaster", short possessive "the broadcaster's", technical "run rate × 20 overs", meaning "The broadcaster's forecast: the runs per over so far, times 20."; add `short(term_id)` and `short_possessive(term_id)` helpers (each falls back to the plain term) and a `bare(text)` helper that drops a leading "the "; update the module docstring
- [x] T004 In `BE/methods.py` add the `projected_score` entry ("the broadcaster's projected score") to `definitions()`; make `terms_payload()` send `short` and `short_possessive`; make sure `terms_version()` still hashes the whole list
- [x] T005 [P] In `PG/terms.ts` add `short` and `short_possessive` (`string | null`) to `Term`, add `shortTerm(id)`, `shortPossessive(id)` and `bareShortTerm(id)` (capitalised on request with the existing `cap`), add `"projected_score"` to `DefinitionKey`, and update the `methodName` doc comment
- [x] T006 [P] Update `PYT/test_terms.py` and `PYT/test_reference_api.py`: the `tv` entry's plain, short and technical terms, `short` and `short_possessive` are null for every other term, `definitions.projected_score` is sent, `terms_version` changes; update `FIX/terms.json` by hand with the same values
- [x] T007 [P] Update `PYT/test_terms_sources.py` and `PYT/test_methods_goal.py` for the new plain term; confirm `METHODS` ("the broadcaster's projection" for method id `broadcaster`) and `cricket_facts.py` line 29 read correctly

**Checkpoint**: the list carries the new names; the sentence builders can start.

---

## Phase 3: User Story 1 - A sharper question on first sight (P1)

**Goal**: the hero, page title and preview tags carry the new question and lead, and the first screen still fits a phone.
**Independent test**: load `/` at 390 × 664 with no run; the h1, goal sentence and Start button are visible without scrolling, no horizontal scroll; the title and preview tags read as the README says.

- [x] T008 [US1] In `PG/hero.ts` change `question()` to "Can an {agent} build a regression model that beats {projected_score}?" built from `term("agent")` and `definition("projected_score")`; keep the neutral fallback "Can an agent build a regression model that beats the projected score?" until the list arrives; change `LEAD` to "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it's tested on a season it has never seen."; reword the header comment
- [x] T009 [US1] In `BE/hero_text.py` (before T015, same file) change `goal_card()`: sentence "Beat the {term('tv')} by at least {shown} runs on average." and the figure label "runs: how far out {short('tv')} usually is, on past innings ({first}–{last})"; reword the docstring
- [x] T010 [P] [US1] In `BE/goal.py` change `lead` to use `short('tv')` ("At 10 overs, the broadcaster shows a projected score. …"); first check where `lead` is read: no front-end code reads it (the page's lead is the constant in `PG/hero.ts`), so this keeps the word check clean and changes nothing visible; read lines 29 and 97 once against the new plain term
- [x] T011 [US1] In `WEB/index.html` set `<title>` and `og:title` (and any `twitter:title`) to "Can an AI agent beat the broadcaster's projected score?" and reword the preview description with "broadcaster", keeping 022's meaning (choose an AI and watch it try); change the Your-turn lead (line 52) to "See the agent's prediction next to the broadcaster's."
- [x] T012 [P] [US1] Update `PYT/test_preview_tags.py`, `E2E/preview-tags.spec.ts`, `E2E/hero.spec.ts`, `E2E/idle.spec.ts` (h1 text, lead, title) and the goal-card cases in `PYT/test_goal_meter.py` and `PYT/test_hero_text.py` (T028 later updates the rest of `test_hero_text.py`; do T012 first)
- [x] T013 [US1] Re-measure the phone first screen (quickstart, "After editing") and record it next to the T002 baseline; if the Start button's bottom edge exceeds 664, set the phone h1 to 1.75rem in `PG/simple.css` line 27 and keep 2.5rem at line 47, then rerun `E2E/idle.spec.ts` until it passes; do not change the copy

**Checkpoint**: US1 is demonstrable on its own.

---

## Phase 4: User Story 2 - One name for the yardstick, everywhere (P1)

**Goal**: no visitor-facing text, at any level, says "TV".
**Independent test**: a finished fake-model run on both pages at all three levels contains no "TV" outside the agent's reasoning, and every row of the design README's examples table appears.

### Backend wording (long form for "…projection", short form for "the TV")

- [x] T014 [P] [US2] `BE/headlines.py`: opening lines "Then it beat the broadcaster.", "It edged the broadcaster, just short of the goal.", "The broadcaster held on this time."; verdict lines 61 to 70 ("the agent beat the broadcaster by …", "the broadcaster missed by …", "the broadcaster beat the agent by …"); result strip lines 92 to 93 ("The {who} was {n} runs out, the broadcaster {m}."), 106 to 107; docstrings
- [x] T015 [US2] `BE/hero_text.py` (after T009): "Knowing the score at 10 overs barely helps / helps / does not help the broadcaster …" (54 to 60), the caption (88, 97, 100: "The broadcaster's straight line said …" using `short_possessive('tv')` per research R3, "the broadcaster's projection {n}"), the constants' comments and docstrings; the hero Commentary asks "How good is the broadcaster?"
- [x] T016 [P] [US2] `BE/cricket_blocks.py`: docstring, topic strings (32, 34), verdict sentences 60 to 70, "The broadcaster misses by …" (80 to 91), titles and sentences 144 to 153 ("Sides speed up, and the broadcaster forgets it", "The broadcaster expects more than sides deliver", "On average the broadcaster is about right", "On average the broadcaster guesses … "), 163 to 175 ("When the broadcaster shows a projected score, …", "The broadcaster's projection is about right on average, …")
- [x] T017 [P] [US2] `BE/accuracy_text.py`: `PROJECTION`, `_CAP_PROJECTION` (capitalise with `cap()`; fix its comment), the label helper's docstring and behaviour ("Broadcaster's projection"), sentence at 108 ("…the broadcaster's projection, the agent's models alike, guesses too …")
- [x] T018 [P] [US2] `BE/stage_info.py` and `BE/wording.py`: read each sentence that uses `term('tv')` against the new plain term (lines 49, 67; 35, 79, 101) and fix any that no longer read well; the baseline step line (wording.py 132) reads "Code is scoring the broadcaster's projection and the average-total guess" and the "doing" line "Scoring the broadcaster's projection and the average-total guess"
- [x] T019 [P] [US2] Reword comments and docstrings only in `BE/cricket_facts.py` (27, 157), `BE/evaluation.py` (20), `BE/nodes.py` (172) and `BE/state.py` (57); change no identifier or dict key
- [x] T020 [P] [US2] `BE/llm_fake.py`: the scripted takeaway sentences say "the broadcaster" (lines 73 to 82); add a second scripted reply that keeps "the TV" for the fallback test (US3)

### Front end

- [x] T021 [P] [US2] `PG/problem.ts`: tile "Broadcaster said" (the `tv-said` test id stays), h2 and heading read from `term("tv")` ("The broadcaster's projection is usually about {n} runs out."); reword the header comment
- [x] T022 [P] [US2] `PG/tryit.ts`: the caption (line 92) and the tile read "Broadcaster: {n}" from the glossary (the Your-turn lead "next to the broadcaster's." is fixed text, T011) (the `tryit-tv` test id stays)
- [x] T023 [P] [US2] `PG/worm.ts` and `PG/worm-layout.ts`: marker text "Broadcaster {n}" (bare short term, capitalised), usual-miss label "Usual miss, ±{n}" (**deviation to confirm**: the README gives no wording for this chart label, and `short_possessive` would also allow "The broadcaster's usual miss" if the width fits; not covered by SC-006), comments reworded; check label widths against `UNIT/worm.test.ts`
- [x] T024 [US2] `PG/final/copy.ts`: read the three sentences using `term("tv")` (lines 52, 54) against the new plain term ("Only the AI agent beat the broadcaster's projection and the average-total guess."); `PG/hero.ts` Commentary label (line 41) reads from the glossary (after T008, same file)
- [x] T025 [P] [US2] Comments only in `PG/run-state.ts` (179), `PG/predict.ts` (39), `PG/final/view.ts` (81), `PG/terms.ts` (70): reword "TV" to "broadcaster"
- [x] T026 [US2] `WEB/under-the-hood.html`: reword the stage 4 (line 177) and stage 7 (line 179) cards and any other prose that says "TV", through the glossary markers the 021 static-text test checks; leave the `data-figure` keys alone
- [x] T027 [US2] `APP/README.md`: reword every "TV" in prose (lines 31, 33, 59, 99, 107 and the identifiers list) to the broadcaster names; leave identifiers untouched

### Tests for US2

- [x] T028 [P] [US2] Update the Python wording tests by hand: `PYT/test_headlines.py`, `test_hero_text.py`, `test_cricket_blocks.py`, `test_accuracy_text.py`, `test_stage_info.py`, `test_stage_notes_numbers.py`, `test_reference_in_run.py`, `test_write_step.py`, `test_static_terms.py`, `conftest.py` (research R7: no regeneration from the code under test)
- [x] T029 [P] [US2] Update the shared fixtures by hand: `FIX/headline_cases.json` (45 hits), `FIX/under-the-hood-reference.json` (14), `FIX/linreg-structure.json`, `FIX/fake-run.json` (a checked-in file the e2e specs read: edit its one "TV" by hand, as it is not rebuilt); check `PYT/fixtures/old_explanation_sentences.json` and edit it only if a test asserts its wording
- [x] T030 [P] [US2] Update the web unit tests: `UNIT/final-copy.test.ts`, `final-fixtures.ts`, `goal-card.test.ts`, `run-state.test.ts`, `found-view.test.ts`, `chart-colours.test.ts`, `under-the-hood-figures.test.ts`, `worm.test.ts`, `worm-fixtures.ts`, `worm-layout.test.ts`
- [x] T031 [P] [US2] Update the e2e specs that assert old wording: `E2E/problem.spec.ts`, `tryit.spec.ts`, `verdict.spec.ts`, `locks.spec.ts`, `scorebook.spec.ts`
- [x] T032 [US2] Add `E2E/broadcaster-wording.spec.ts`: on a finished fake-model run, assert every row of the design README's examples table (goal card sentence and figure, result strip, problem h2 and tile, verdict h2, bars and closeness label, rule of thumb, Your turn lead and tile, "Right now" baseline line, hero Commentary question and "guesses too low", run-by-over chart text), with numbers and years taken from the backend; also assert no "TV" in text, aria-labels, titles or live-region lines on both pages at Scoreboard, Commentary and Scorebook levels

**Checkpoint**: US1 and US2 together deliver the visible change.

---

## Phase 5: User Story 3 - The name stays fixed and a live model uses it (P2)

**Goal**: the reword prompt uses the new name; the old name is banned; guards catch a return.
**Independent test**: a planted "TV" fails the banned-term check; a fake reply with "the broadcaster" is accepted and one with "the TV" falls back.

- [x] T033 [US3] `BE/prompts.py` line 169: change only the example wording ("the TV projection guesses {tv_bias_runs} runs {tv_bias_direction}") to "the broadcaster guesses {tv_bias_runs} runs {tv_bias_direction}"; touch no other line of the prompt (if a prompt hash or snapshot test exists, update it and say so)
- [x] T034 [US3] `BE/methods.py` `BANNED`: add `\bTV projection\b`, `\bthe TV\b` and `\bTV\b` (case-insensitive, allowed in no region); confirm `banned_payload()` sends them and `BE/writing_reply.py` rejects a reply that matches
- [x] T035 [P] [US3] Extend `PYT/test_wording_no_banned.py`: a planted "TV", "the TV" and "TV projection" fail; "television" and "tvs" pass; the agent's quoted reasoning stays exempt
- [x] T036 [P] [US3] Extend `PYT/test_writing_reply.py` and `PYT/test_write_step.py`: a fake reply with "the broadcaster" is accepted; the scripted reply with "the TV" (T020) is rejected and the step falls back to the template wording
- [x] T037 [P] [US3] Add a Python guard test `PYT/test_no_literal_tv.py`: no string literal, comment or docstring in `BE/*.py` contains "TV" as a word (identifiers, dict keys and fact ids with lowercase `tv` are excluded)
- [x] T038 [P] [US3] Add `PYT/test_tv_identifiers.py`: a recorded list of the identifiers that must keep "tv" (term id `tv`, method id `broadcaster`, fact ids `tv_gap`, `tv_test_miss`, `tv_bias_runs`, `tv_bias_direction`, `tv_bias_large`, reference keys `tv_miss`, `tv_projection`, `goal_card.tv`) all still exist, and the web test ids (`tv-miss`, `tv-said`, `tv-sentence`, `tv-footnote`, `tryit-tv`) and classes (`tv-figure`, `tv-figures`) still appear in `PG/*.ts`; covers FR-009 and FR-011
- [x] T039 [P] [US3] Extend `UNIT/no-literal-terms.test.ts` with the same check over `WEB/src` (comments and string literals), and `E2E/banned-terms.spec.ts` reads the new patterns from the served payload; add no entry to `E2E/banned-terms.allow.ts`

**Checkpoint**: all three stories done.

---

## Phase 6: Polish and cross-cutting

- [x] T040 Run `grep -rnw TV` over `BE`, `PG`, `WEB/src`, `WEB/*.html` and `APP/README.md`; expect no hits other than quoted agent reasoning in fixtures
- [x] T041 Run 021's banned-term check and 022's word counts (`E2E/word-count.spec.ts`) on both pages, simple and everything open, before a run and after a fake-model run; the simple view stays within 500 words and everything open within 1,200
- [x] T042 Run all suites (`pytest`; `npx tsc --noEmit`, `npx vitest run`, `npx playwright test`) and the quickstart's manual spot check; record results and the final phone measurement in `specs/023-broadcaster-projection/quickstart.md`
- [x] T043 Tick the checklist in `specs/023-broadcaster-projection/checklists/requirements.md` against the finished work and confirm each success criterion SC-001 to SC-006 with the evidence (test names or measurements)

---

## Dependencies and order

- **Phase 1** first. **Phase 2** (term list) blocks everything else.
- **US1** (Phase 3) and **US2** (Phase 4) can run in either order once Phase 2 is done; T013 (phone measurement) comes after T008 and T011.
- **US3** (Phase 5): T034 (banned list) comes after US2's backend wording (T014 to T019) or the older tests and fake model fail on the new patterns; T036 needs T020 and T034.
- **Phase 6** last.

Plan order mapping: term list and backend wording = Phase 2 and T014 to T020; front end = T005 and T021 to T025; fixed text = T008, T011, T026, T027; prompt example = T033; banned list = T034; tests and phone check = T006, T007, T012, T013, T028 to T032, T035 to T043.

## Parallel examples

- After T004: T005, T006, T007 together.
- US2 backend: T014 to T020 touch different files and can run together; the front end tasks T021 to T025 likewise.
- Tests: T028, T029, T030, T031 touch different files and can run together once their wording tasks are done.

## Implementation strategy

1. MVP is Phase 1, Phase 2 and US1: the hero question and the phone check. This is visible but leaves "TV" in the body, so do not ship it alone.
2. Add US2 for the full visible change, then US3 to lock it in; the feature ships after Phase 6.
3. Commit after each phase with the suites green.
