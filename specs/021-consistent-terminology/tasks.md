# Tasks: Consistent Terminology

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/terms.md](contracts/terms.md), [quickstart.md](quickstart.md)
**Tests**: Requested by the spec (FR-005, FR-006, FR-012, FR-013) and listed in the plan, so test tasks are included.

Paths are relative to the repo root. `APP` = `apps/linear_regression`; `BE` = `APP/backend/linreg`; `WEB` = `APP/web`; `PG` = `WEB/src/page`.

**Format**: `- [ ] T### [P?] [Story?] Description with file path`. `[P]` = different files, no dependency on an unfinished task.

**Stories** (from the spec):
- **US1** (P1) See one name for each thing: backend and front-end wording, the recorded run
- **US2** (P1) Learn what the brute-force search is: definition, Commentary note, verdict link
- **US3** (P2) Look up any term: "Words we use"
- **US4** (P2) Keep the wording from drifting back: region markers and the banned-term check

---

## Phase 1: Setup

- [x] T001 Run the full suites (`uv run pytest` in `APP`; `npm run test` and `npx playwright test` in `WEB`) and confirm they are green before any change; note any pre-existing failure in `specs/021-consistent-terminology/quickstart.md`
- [x] T002 Add a `console.info` of the measured counts per page and level to `WEB/tests/e2e/word-count.spec.ts` (limits unchanged), run it, and fill the "Before" column of the word-count table in `specs/021-consistent-terminology/quickstart.md`

---

## Phase 2: Foundational (blocks every story)

**The term list, its service, and the front-end module. No wording changes yet.**

- [x] T003 Add `Term`, `TERMS` (ten rows from [data-model.md](data-model.md), one-line meanings of at most 14 words), `term()`, `with_technical()`, `meaning()` to `BE/methods.py`
- [x] T004 In `BE/methods.py` add `BANNED` (patterns and `allowed_in` per [data-model.md](data-model.md)) and `DEFINITIONS` (`brute_force` exact sentence from the spec, `brute_force_technical`, `brute_force_honest`; 24 from `setup_settings.grid_combinations()`, the clue count and 2^n from the feature catalogue, none typed)
- [x] T005 In `BE/methods.py` add `terms_payload()` and `terms_version()`; make `METHODS` names read from `TERMS` (method ids and marker shapes unchanged)
- [x] T006 [P] Write `APP/tests/test_terms.py`: ten ids, unique plain terms, no banned pattern in plain/alt/meaning, stable order, `DEFINITIONS` numbers computed
- [x] T007 Extend `BE/reference_api.py` to send `terms`, `definitions`, `banned`, `terms_version`, also on the `NOT_LOADED` failure path; extend `APP/tests/test_reference_api.py` (fields present with and without data)
- [x] T008 [P] Create `PG/terms.ts` (`setTerms`, `term`, `termWithTechnical`, `meaning`, `definition`; "not available right now" before `setTerms`) and `WEB/tests/unit/terms.test.ts`
- [x] T009 Read the new fields in `PG/reference.ts` and `PG/reference-types.ts` and call `setTerms`; update `WEB/tests/fixtures/under-the-hood-reference.json` with `terms`, `definitions`, `banned`

**Checkpoint**: `/api/reference` serves the list; the page can read it; no visible wording has changed.

---

## Phase 3: User Story 1 - See one name for each thing (P1)

**Goal**: every visible word on both pages uses the glossary, from the list, at every level.
**Independent test**: backend wording tests and the reword check pass; the front-end literal-name test passes; a look at both pages fully open finds one name per concept.

### Backend wording (single source)

- [x] T010 [US1] Make `METHOD_LABELS` derive from `methods` and reword the fact `meaning` strings in `BE/cricket_facts.py`
- [x] T011 [P] [US1] Use `term(...)` in the template sentences of `BE/cricket_blocks.py`
- [x] T012 [P] [US1] Use `term(...)` in `BE/accuracy_text.py`
- [x] T013 [P] [US1] Use `term(...)` in `BE/hero_text.py`
- [x] T014 [P] [US1] Use `term(...)` in the verdict and rule-of-thumb wording of `BE/goal.py`
- [x] T015 [P] [US1] Read the brute-force name and `subject_label` from the list in `BE/headlines.py`
- [x] T016 [P] [US1] Use `term(...)` in the `why` strings of `BE/selection.py` (function names unchanged)
- [x] T017 [P] [US1] Reword `HYPERPARAMETER_NOTE`, the grid note and other user-visible strings of `BE/setup_settings.py`, `BE/scoring.py`, `BE/stages.py`, `BE/stage_info.py` (row note for the yardstick row too)
- [x] T018 [US1] Pull the wording out of the node bodies in `BE/nodes.py` into pure helpers (`baseline_summary`, `grid_summary`, `final_summary`, `winner_name`, `explain_*`), each returning exactly today's string apart from the terms; no change to scores, edges or state keys (`forward_best` stays)
- [x] T019 [US1] Reword the helpers' terms from `term(...)` in `BE/nodes.py` and run the 020 node and run tests after each helper moves
- [x] T020 [US1] Reject banned patterns (from `BANNED`) in `_check_text` of `BE/writing_reply.py` so a model reply containing one falls back to the template wording (FR-005); keep `BE/llm_fake.py` reasoning as is and fix its scripted writing replies only if they contain a banned term
- [x] T021 [P] [US1] Write `APP/tests/test_terms_sources.py` (changing a term in a temporary list changes `METHOD_LABELS`, `method_defs`, node summaries and `headlines`)
- [x] T022 [P] [US1] Write `APP/tests/test_wording_no_banned.py` (every wording function on the fixtures has no banned pattern; "forward selection" only inside bracketed technical strings)
- [x] T023 [P] [US1] Extend `APP/tests/test_writing_reply.py` (a reply with a banned term is rejected and falls back)
- [x] T024 [US1] Update expected copy in the 020 backend tests: `test_cricket_blocks`, `test_cricket_facts`, `test_hero_text`, `test_headlines`, `test_methods_goal`, `test_know_nothing`, `test_explanation_numbers`, `test_explanation_reference`, `test_stage_info`, `test_stage_notes_numbers`, `test_grid_search`, `test_selection`, `test_final_test`, `test_agent_model`, `test_accuracy_text`; regenerate `APP/tests/fixtures/old_explanation_sentences.json`; run `uv run pytest` in `APP`

### Recorded run

- [x] T025 [US1] Create `APP/scripts/reword_recorded_run.py`: fold events to state, rebuild every code-worded string listed in research R2 with the backend functions, write `wording_version`, leave numbers, proposal reasons and `fingerprint` untouched, `--check` exits 1 when out of date, `--file` takes another path, stop and report the path if an input is missing
- [x] T026 [US1] Write the `wording_version` in `APP/scripts/record_run.py` when recording
- [x] T027 [P] [US1] Write `APP/tests/test_reword_script.py` (idempotent; no number, proposal reason or fingerprint changes; refuses a fingerprint that does not match the data)
- [x] T028 [US1] Run the script on `WEB/public/recorded-run.json` and on `WEB/tests/fixtures/recorded-run.fake.json`; confirm the old-term count in both is zero
- [x] T029 [US1] Extend `APP/tests/test_recorded_run.py`: the file's `wording_version` equals the code's and a fresh rebuild of every code-worded string equals the file's

### Front end reads the list

- [x] T030 [P] [US1] Replace literal method names with `term(...)` in `PG/final/copy.ts`, `PG/final/view.ts`, `PG/final/differ.ts`, `PG/final/takeaways.ts`; keep builders pure by passing a names argument; update `WEB/tests/unit/final-copy.test.ts`, `final-takeaways.test.ts`, `final-closeness.test.ts`, `final-fixtures.ts`
- [x] T031 [P] [US1] Same for `PG/found/grid.ts`, `PG/found/ranking.ts`, `PG/found/view.ts` (chart keys, the "Found by" column, the star line, the caption); update `WEB/tests/unit/found-choice.test.ts`, `found-view.test.ts`, `found-fixtures.ts`
- [x] T032 [P] [US1] Same for `PG/verdict.ts`, `PG/verdict-bars.ts`, `PG/tryit.ts`, `PG/leaderboard.ts`, `PG/hero.ts`, `PG/scoreboard.ts`
- [x] T033 [P] [US1] Same for `PG/round-feed.ts`, `PG/watch.ts`, `PG/catalogue.ts`, `PG/setup.ts`; update `WEB/tests/unit/round-feed.test.ts`, `setup.test.ts`
- [x] T034 [P] [US1] Same for the worm chart: `PG/worm.ts`, `PG/worm-layout.ts` (key "Know-nothing", SVG titles, descriptions, aria-labels); update `WEB/tests/unit/worm.test.ts`, `worm-fixtures.ts`, `worm-layout.test.ts`, `exam.test.ts`, `scoreboard.test.ts`, `models.test.ts`
- [x] T035 [US1] Apply the technical-term-once rule: in each Commentary panel and each Scorebook panel renderer, the first mention of a concept uses `termWithTechnical(id)` and later mentions `term(id)`; add a unit test per renderer that the technical term appears once
- [x] T036 [US1] Rename visible "test year" to "test season" in the backend and front-end strings that reach the page (research Open point 2; skip if the owner decides to keep "year")
- [x] T037 [US1] Write `WEB/tests/unit/no-literal-terms.test.ts`: no file under `PG` except `terms.ts` has a glossary plain term or banned pattern inside a string or template literal; fix any hit
- [x] T038 [US1] Update the 020 e2e specs whose expected copy changed: `verdict`, `scorebook`, `play`, `panels`, `stages`, `llm-run`, `contrast`, `cricket-terms`, `hero`, `live-region`, `under-the-hood`, `preview-tags` in `WEB/tests/e2e/`; update `WEB/tests/fixtures/linreg-structure.json`; run Vitest and Playwright
- [x] T039 [US1] Reword the page titles, preview tags and `under-the-hood.html` prose to the glossary in `WEB/index.html` and `WEB/under-the-hood.html`; write `APP/tests/test_static_terms.py` (no banned pattern; glossary terms spelled as in the list; known variants absent); update `APP/tests/test_preview_tags.py` and `WEB/tests/e2e/preview-tags.spec.ts`

**Checkpoint**: both pages use one name per concept; the recorded run passes the wording test. US1 is shippable alone.

---

## Phase 4: User Story 2 - Learn what the brute-force search is (P1)

**Goal**: the definition, its technical note and the verdict link.
**Independent test**: `WEB/tests/e2e/brute-force.spec.ts` passes.

- [x] T040 [US2] Add the `#brute-force` paragraph slot directly under `<graph-replay>` in part 3 of `WEB/under-the-hood.html` and the Commentary slot in `#commentary-agent`; render both in `PG/under-the-hood/main.ts` from `definition("brute_force")`, `definition("brute_force_technical")` and `definition("brute_force_honest")`
- [x] T041 [P] [US2] Style the definition line and the Commentary note in `PG/under-the-hood/under-the-hood.css` on existing tokens
- [x] T042 [US2] Link the first "brute-force search" in the verdict to `/under-the-hood.html#brute-force` in `PG/verdict.ts`, matching on `term("brute_force")`, not a literal
- [x] T043 [US2] Make a link to `#brute-force` land on the definition: `followDefinitionLink` in `PG/under-the-hood/words.ts` scrolls to it and focuses it once its words have arrived (`PG/anchors.ts` is the main page's old-link table and needed no change)
- [x] T044 [US2] Write `WEB/tests/e2e/brute-force.spec.ts`: the sentence is visible with Commentary closed and equals the backend string; the verdict link lands on it in one click; the Commentary paragraph shows 24 and 2^19 (about 524,000)

**Checkpoint**: a visitor reaches the definition in one click from the verdict.

---

## Phase 5: User Story 3 - Look up any term (P2)

**Goal**: "Words we use" in Commentary.
**Independent test**: the glossary lists ten rows in list order.

- [x] T045 [US3] Add the "Words we use" slot to `#commentary-big` in `WEB/under-the-hood.html` and render a `<dl>` from `terms` in list order (plain term, technical term, meaning) in `PG/under-the-hood/main.ts`
- [x] T046 [P] [US3] Style the glossary list in `PG/commentary.css`
- [x] T047 [US3] Add the glossary case to `WEB/tests/e2e/brute-force.spec.ts` (or `under-the-hood.spec.ts`): ten rows, order equals the served list, each with a technical term and a meaning; a changed term in a fixture shows up without a page edit

**Checkpoint**: glossary rendered from the same source as every other word.

---

## Phase 6: User Story 4 - Keep the wording from drifting back (P2)

**Goal**: marked regions and the automated check.
**Independent test**: injecting "the rival" into an unmarked region fails the check; into a reasoning region it does not.

- [x] T048 [US4] Add `data-region="commentary"` to every Commentary panel built in `WEB/index.html`, `WEB/under-the-hood.html` and the renderers; add a unit test that every `.commentary` element has it
- [x] T049 [P] [US4] Add `data-region="scorebook"` to `#scorebook-panel` and each full reference view in `PG/scorebook.ts`
- [x] T050 [P] [US4] Add `data-region="reasoning"` to every element showing the agent's words verbatim (`PG/round-feed.ts`, `PG/watch.ts`, the state view in `WEB/src/graph-replay/state-view.ts` if it prints proposal reasons)
- [x] T051 [P] [US4] Add `data-region="definition"` to the "Words we use" list and the brute-force paragraphs
- [x] T052 [US4] Create `WEB/tests/e2e/banned-terms.allow.ts` (the "setup" allowlist, empty) and `WEB/tests/e2e/banned-terms.spec.ts` per [contracts/terms.md](contracts/terms.md) §5: both pages, recorded run finished, `?view=everything`, each Scorebook panel opened in turn; collect text nodes with region, aria-label, aria-labelledby targets, alt, title, SVG title/desc, live-region text and announcements, `document.title`, preview meta; failure names term, page and nearest landmark; banned list read from the served `banned`; "forward selection" passes only inside brackets after a plain term (commentary, scorebook) or inside a definition region
- [x] T053 [US4] Add the self-test to the spec: inject "the rival" into an unmarked region and a `reasoning` region and assert only the first is reported
- [x] T054 [US4] Add the fake-model live-run case to the same spec (finish a `fake/steady` run, repeat the collection)
- [x] T055 [US4] Fix every hit the check finds (strings missed in T010 to T036) until it passes on both pages and both run sources

**Checkpoint**: the check is green and demonstrably able to fail.

---

## Phase 7: Polish and cross-cutting

- [x] T056 Re-run `word-count.spec.ts`, fill the "After" column in `specs/021-consistent-terminology/quickstart.md`; if How this app was built is over 500 simple or 1,200 open, cut wording in the order in research R11 (never the spec's definition sentence) and record each cut
- [x] T057 [P] Check contrast and phone width (390 px) for the new definition line and glossary: `WEB/tests/e2e/contrast.spec.ts`, `phone.spec.ts`
- [x] T058 [P] Update `APP/README.md` and `WEB/src/page` comments only where they describe method names that changed; leave identifiers alone (FR-007)
- [x] T059 Run `reword_recorded_run.py --check`, `uv run pytest`, `npm run test` and `npx playwright test`; confirm `test_no_test_year_leak` is green
- [x] T060 Walk both pages fully open in light and dark themes and read them once for one name per concept (SC-002); note anything the check cannot see

---

## Dependencies

```text
Phase 1 → Phase 2 → US1 (Phase 3) ──┬→ US2 (Phase 4) → US3 (Phase 5)
                                    └→ US4 (Phase 6, after US2 and US3 so their regions exist)
                                       → Polish (Phase 7)
```

- Phase 2 blocks everything. US1 blocks US2 to US4 (the pages must already use the list).
- Within US1: backend T010 to T024 before the recorded-run tasks T025 to T029; both before front end T030 to T038; T039 (static text) is part of the US1 checkpoint (the page reads the reworded file).
- US3 depends on US2 only for the shared slot code in `main.ts`; they could run in parallel on different files.
- T018 before T019; T025 after T018 (the script calls the helpers).

## Parallel examples

- After T005: T006, T008 together (backend test, front-end module).
- US1 backend: T011 to T017 together (separate files), then T018, T019.
- US1 front end: T030 to T034 together (separate files).
- Phase 6: T049, T050, T051 together.

## Implementation strategy

1. **MVP = US1** (Phases 1 to 3): one name everywhere, recorded run reworded. Ship-ready alone.
2. Add US2 (definition and link), then US3 (glossary), then US4 (the check that locks it in).
3. Run the full suites at the end of each phase before starting the next; at T038, T055 and T059 they must be fully green.

**Counts**: 60 tasks. Setup 2, Foundational 7, US1 30, US2 5, US3 3, US4 8, Polish 5.
