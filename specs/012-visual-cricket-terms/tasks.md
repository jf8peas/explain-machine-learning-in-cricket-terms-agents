# Tasks: A Visual "In Cricket Terms", Then Written by the Language Model

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/explanation.md](contracts/explanation.md), [quickstart.md](quickstart.md)
**Prerequisites**: none beyond the repo (no `.specify` scripts or template exist; standard layout used by hand).
**Tests**: required by the spec (FR-011, FR-020, SC-001 to SC-007) and the plan, so test tasks are included. No test calls a real language model.
**Note**: the planning brief was cut off in its Story 2 section; research decisions 6 to 10 are the defaults to confirm. Tasks for Story 2 (Phase 4) follow those defaults.

All paths are under `apps/linear_regression/` unless stated. `B` = `backend/linreg/`, `W` = `web/`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

Stories: **US1** the visual section with template wording (P1, ships on its own), **US2** the language model writes the words (P2).

---

## Phase 1: Setup

- [x] T001 Run the backend suite (`uv run python -m pytest -q`), `cd W && npm run test` and `npx playwright test` for a green baseline; then `grep -rn` for `cricket_explanation`, `build_explanation`, `explain_in_cricket_terms`, `"explanation"`, `most_important`, `explanation.comparison`, `.sentences` and the old sentence wording ("We judged every setup", "The biggest factor was", "Each extra wicket") over `B/`, `tests/`, `W/src`, `W/tests`, `README.md`; list every test or module that must change; save the old sentence list for one fixed run state as a test fixture file `tests/fixtures/old_explanation_sentences.json` (for the word-count check, T014)

---

## Phase 2: Foundational (blocks both stories)

- [x] T002 Create `B/cricket_facts.py` with `build_facts(state, labels, margin_runs)` returning `{fact_id: {value, unit, display, meaning}}` for every fact in data-model.md, reusing without change the importance figure (`|coefficient × feature_iqr|`), the goal verdict and percentage (`B/goal.py`, `final.accuracy`), the rolling-check and test years (`state["split"]`), the validation errors and winner; `display` is rounded as the page already rounds (runs to one decimal, shares as whole percentages, years as years, the margin as a whole number when whole); omit the wicket facts when the winning model has neither wicket feature; one `effect_<feature>` and `typical_difference_<feature>` per feature
- [x] T003 [P] Create `tests/test_cricket_facts.py`: facts for reached, beat-but-missed and did-not-beat runs; wicket cost, wicket gain, wickets-in-hand and no-wicket-feature models; one feature; very unequal effects; every `display` follows the rounding rules; every fact id in data-model.md is present when applicable; no fact uses a value that is not in the state
- [x] T004 Create `B/cricket_blocks.py`: `fill(text, facts)` (replaces `{fact_id}` with `display`, raises on an unknown id, leaves no placeholder), the per-block templates in `{fact_id}` syntax (verdict: reached / beat but missed the goal / did not beat; wicket: cost / did not cost runs / omitted; drivers, how_chosen, closing: one each), and `build_blocks(facts)` returning the block list in default order with the visual data (drivers bar rows `{feature, label, fact_id, effect_runs, display}` sorted biggest first; the wicket fact id and direction; the year segments `{kind, from, to}` for training, check and test years); wording within the plan's limits (title ≤ 40 characters, ≤ 2 sentences, each ≤ 120 characters)
- [x] T005 [P] Create `tests/test_cricket_blocks.py`: `fill` replaces every placeholder and raises on an unknown one; each template variant is chosen for the right case (reached, beat but missed, did not beat; wicket cost, gain, omitted); drivers sorted by absolute effect with signs kept; one-feature case; the year segments match the split; **every number in every filled text equals a fact's display** (extract numbers from the text and compare to the facts); every title and sentence is within the limits

**Checkpoint**: facts and template blocks are pure, tested and independent of the graph and the web.

---

## Phase 3: User Story 1 - A visual "In cricket terms" with template wording (P1) 🎯 MVP

**Goal**: the section is the five blocks with charts, built from facts and templates; the run does not use the language model for it.
**Independent test**: run with the model absent; the section shows the blocks, every number equals a fact, and the text is at most half the old list's words.

- [x] T006 [US1] In `B/nodes.py` rebuild `explain_in_cricket_terms` to call `build_facts` and `build_blocks` and return `{"explanation": {facts, blocks, order, source: "template", model: None, fallback_reason: None}, "summary": ...}` (keeping the key `explanation` and a summary line in plain words); remove the old sentence and comparison building from it; document the new shape in `B/state.py`
- [x] T007 [US1] Remove `B/cricket_explanation.py` once nothing imports it (its calculations now live in `B/cricket_facts.py`); update every import found in T001
- [x] T008 [US1] Update the Interpret stage note in `B/stage_info.py` (and `EXPECTED["interpret"]` in `tests/test_stage_info.py`, and the numbers test if needed) so it describes what the section now does without saying the model cannot write: code builds the facts and template blocks, and a separate language-model step may write the wording from placeholders, with every number filled in by code from the facts
- [x] T009 [P] [US1] Rewrite `tests/test_explanation_numbers.py` and `tests/test_explanation_reference.py` (and any other test from T001's list) for the facts and blocks: the same numbers are still checked, now against `facts`; nothing that matters about the numbers is dropped
- [x] T010 [P] [US1] Create `W/src/page/cricket-terms.ts` with pure helpers and the renderer: bar scaling and signed positions with a diverging axis, label placement that keeps the smallest bar visible and labelled, year-strip segments, text-equivalent builders; `renderCricketTerms(target, explanation)` builds, in `order`, the verdict headline with a badge made of words plus a shape (no colour alone), the drivers SVG chart with a visually hidden table (`drivers-table`), the large wicket figure, the year strip with `years-table`, and the closing sentence; colours from the page's theme tokens; no animation; set text with `textContent` only; test ids per contracts/explanation.md
- [x] T011 [US1] In `W/src/page/results.ts` (`renderFinal`) replace the list of sentences with `renderCricketTerms`, keep the `explanation` test id on the section container, and make `finalComparison` read its figures from `facts` (not the removed `comparison` dict); add the styles for the section to `W/index.html` using the existing tokens, readable in light and dark and at phone width
- [x] T012 [P] [US1] Create `W/tests/unit/cricket-terms.test.ts` for the pure helpers: bar scaling and signs, smallest bar still visible, one-bar case, label text, strip segments, text equivalents list every value
- [x] T013 [US1] Update the e2e tests that read the old list (`W/tests/e2e/explanation.spec.ts`, `reference.spec.ts` and any from T001) and add cases: the blocks appear in order with the badge words "Goal reached" or "Goal missed" and a shape; each chart has a text equivalent giving its values; the section has no sideways page scroll at 390px and reads in light and dark; no animation; stepping back before the final test hides the section; the goal reached / beat but missed / did not beat wording (use a crafted state via the existing `serveRun` approach, as `reference.spec.ts` does)
- [x] T014 [US1] Add the word-count test: for the saved old sentences (T001) and the new section's text for the same run state, assert the new text is at most half the old; and a test that every figure removed from the section's text is still shown elsewhere on the tab (comparison block, accuracy table, chart or best-setup lines)

**Checkpoint**: with the model absent or with any model, the section appears complete with template wording; all backend and web tests pass.

---

## Phase 4: User Story 2 - The language model writes the words (P2)

**Goal**: a final language-model step writes titles and sentences in placeholders; code validates and fills them; failures fall back to the templates.
**Independent test**: with the scripted fake model, a valid reply is shown; replies with digits, unknown placeholders, over-length text or no budget are never shown and the template wording appears with one line saying why.

- [x] T015 [US2] Create `B/writing_reply.py`: `parse_writing_reply(text, facts, limits)` per data-model.md: JSON in the agreed shape; reject the whole reply for any digit anywhere in a title or sentence, a placeholder that is not a fact id, an over-length title or sentence, or unparseable JSON (a clear `UnusableReply`-style error); keep a block's template when its title or sentences are missing; accept `order` and `closing_lead` only from the fixed lists, else use defaults; return the per-block wording with placeholders still in it
- [x] T016 [P] [US2] Create `tests/test_writing_reply.py`: a valid reply; a digit (including inside words such as "10th" and in a digit-like character such as a full-width digit); an unknown placeholder; a placeholder written with the wrong braces; a title and a sentence over the limits; non-JSON; JSON of the wrong shape; a block id not in the fixed set; missing title or sentences (that block keeps its template, the rest keeps the model's); `order` with an unknown id (default order); `closing_lead` that is not a fact (default)
- [x] T017 [US2] In `B/prompts.py` add `build_writing_request(facts, blocks, limits, model, max_tokens, timeout)`: fact ids with plain meanings, units and display values; the fixed blocks and what each shows; the placeholder rule; the length limits; the instruction to write no digit, state nothing as a statistic that is not a fact, and add no block; structured output as the existing request does
- [x] T018 [US2] In `B/run_budget.py` reserve one call for the writing step (the proposing rounds may not use it up; default `LLM_MAX_CALLS` grows by one, or the call is taken from the same pool: decide and record in research.md) and add `take_writing_call()` returning a timeout from the time the deadline allows after a small reserve, or `None` below `MIN_CALL_SECONDS`; add tests in `tests/test_run_budget.py` (or the existing budget tests) that the call counts, cannot be starved by proposing retries, and is refused when no time is left
- [x] T019 [US2] In `B/nodes.py` add `write_in_cricket_terms(state, config, llm)`: keep the template wording and set `fallback_reason` (one short line) when the model did not take part, is unavailable or there is no budget (no call is made); otherwise take the call, send `build_writing_request`, parse with `parse_writing_reply`, fill placeholders with `fill`, and return `{"explanation": {...source: "language model", model: <name>, order, blocks}, "summary": ...}`; catch `LlmTimeout`, `LlmUnavailable`, other `LlmError`, `UnusableReply` and any unexpected exception so the run never fails or waits beyond its deadline because of this step; log (without any key) as the proposing step does
- [x] T020 [US2] In `B/graph.py` add the node and the edges `final_test → explain_in_cricket_terms → write_in_cricket_terms → END`, add `write_in_cricket_terms` to `NODE_ACTORS` as `"llm"` and to `NODE_STAGES` as `"interpret"`, and update the module docstring
- [x] T021 [US2] In `B/llm_fake.py` add scripted writing replies per fake model id so every path is testable with no network: valid (uses placeholders only), a digit, an unknown placeholder, over-length text, a missing block, markup/HTML in a sentence (shown as text, never as markup), broken and timeout (the existing fake kinds); the proposing replies are unchanged
- [x] T022 [P] [US2] Create `tests/test_write_step.py` with the fake model: a valid reply sets `source` "language model", the model's name and order, and every number in the filled text equals a fact; each rejected reply kind leaves the template wording with a `fallback_reason`; a missing block keeps its template; the model absent / failed / timed out / no budget keep the templates and make no call or a counted call as appropriate; the run completes inside the deadline in every case; the call count is correct; the step never raises
- [x] T023 [US2] Update the tests and fixtures that name the graph's nodes or end: `tests/test_agent_run.py`, `tests/test_structure_stages.py` and the web fixture `W/tests/fixtures/linreg-structure.json` (regenerate from `GET /api/structure`), `tests/test_stage_info.py` stage-node checks, the "timeline has 23 steps" and similar counts, `W/tests/e2e/reuse.spec.ts` and `stages.spec.ts` (a step added; `explain_in_cricket_terms` no longer last; the last node is `write_in_cricket_terms`), `W/tests/e2e/helpers.ts` if it depends on the last step, and the graph layout tests if a node was added to the Interpret row
- [x] T024 [US2] In `W/src/page/cricket-terms.ts` show the label "Wording written by the language model (<name>)" (test id `writer-label`, styled like the model's reasoning block) when `source` is "language model", and the one-line `fallback_reason` (test id `writer-fallback`) when set; text only
- [x] T025 [P] [US2] Add e2e cases to `W/tests/e2e/explanation.spec.ts` (or a new `cricket-terms.spec.ts`): with the default fake model the label names the model and shows its titles and sentences; with "Unreliable" the template wording and the fallback line show; stepping back to the explain step shows template wording and the write step shows the model's; the graph shows `write_in_cricket_terms` as a language-model step in stage 8; a crafted state whose wording contains markup is shown as text; every number in the section equals a fact (read `facts` from the state panel)
- [x] T026 [US2] Update the Interpret stage note, README and the structure contract text if the new node needs mention (`README.md`, `specs/005-ml-stages/contracts` stay as history); confirm `tests/test_boundaries.py` still passes (the new modules import nothing they should not)

**Checkpoint**: both stories work; a failing or absent model never changes the run's result or its time limit.

---

## Phase 5: Polish

- [x] T027 Run the full backend suite, `npx tsc --noEmit`, `npm run test` and `npx playwright test`; fix anything left; confirm no test reaches the network (the existing key-never-leaks and fake-model checks still pass)
- [x] T028 [P] Update `README.md` (what the final test tab shows; the new step and its fallback), `W/src/graph-replay/README.md` only if needed, and `specs/012-visual-cricket-terms/plan.md` with a "Changes made while implementing" section for any decision settled during the work (the call budget choice, the limits)
- [x] T029 Run `quickstart.md` by hand: with the fake model, "Unreliable", light and dark, phone width; have a person read the section for a few seconds and say whether the goal was reached, what mattered most and what a wicket cost (SC-004)

---

## Dependencies and order

- T001 first. Foundational T002 → T004 (blocks use facts); T003 after T002; T005 after T004.
- US1: T006 needs T002 and T004; T007 after T006; T008 and T009 after T006; T010 can start after T004 (the shape is fixed in data-model.md); T011 after T006 and T010; T012 after T010; T013 after T011; T014 after T011.
- US2 needs US1's shape: T015 first (after T004); T016 after T015; T017 after T002 and T004; T018 independent; T019 after T015, T017, T018; T020 after T019; T021 after T015; T022 after T019 to T021; T023 after T020; T024 after T011; T025 after T023 and T024; T026 last in the phase.
- Polish last.

## Parallel opportunities

- T003 and T004 together (different files) once T002 exists; T005 after T004.
- T008, T009, T010 and T012 together after their prerequisites (different files).
- T016, T017 and T018 together once T015 exists; T022 and T024 together after T019 to T021.
- T028 alongside T027.

## Implementation strategy

- **MVP**: Phases 1 to 3 (US1). It delivers the whole visual section with template wording, the model not involved, and every number from facts. Commit on its own.
- Then US2 on top. If a decision about the call budget or the reply limits needs changing, only Phase 4 is affected.
- Keep the test suites green after each phase; update the old-sentence tests in the same phase that changes the section.
- If the brief's missing Story 2 details differ from research decisions 6 to 10, change those decisions first (T015 to T019 follow them).
