# Implementation Plan: Consistent Terminology

**Branch**: `021-consistent-terminology` (work is on `main`; no branch hook ran) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)
**Input**: The specification and the planning brief. Decisions and reasons are in [research.md](research.md); the entities in [data-model.md](data-model.md); the interfaces in [contracts/terms.md](contracts/terms.md).

## Summary

Give every method and idea one name. A term list in `backend/linreg/methods.py` becomes the single source; the other backend wording reads from it and it is served in `/api/reference`; the front end takes every method name from it. The recorded run, a static file, is reworded by a no-model script and kept honest by a test. The brute-force search gets a definition (Scoreboard sentence under the graph, Commentary paragraph, "Words we use" glossary, verdict link). A Playwright check renders both pages, fully open, and fails on any banned term outside marked regions.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI, LangGraph); TypeScript 5 (Vite 5, no framework)
**Primary Dependencies**: none new
**Storage**: none new; one existing static file is reworded (`web/public/recorded-run.json`)
**Testing**: pytest (`apps/linear_regression/tests`), Vitest (`web/tests/unit`), Playwright (`web/tests/e2e`, fake language model)
**Target Platform**: as feature 020
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: none new; `/api/reference` stays cached; the term list adds under 3 KB
**Constraints**: scoring, nodes, edges and prompts' structure unchanged; method ids, state keys, CSS classes and test ids unchanged; 020's word limits; the graph component keeps no cricket words; no literal method names in `web/src/page`
**Scale/Scope**: about 20 backend files and 22 front-end files changed, 7 new files, 4 test files rewritten in part

## Constitution Check

No constitution exists, so there are no gates. Principles carried from earlier features: one source for each fact (extended here to words); no new dependency or route; the test season stays sealed (wording functions run on data the step already holds; `test_no_test_year_leak` stays green); test ids and state keys are not renamed.

**Re-check after design**: no violations. Two deviations from the brief are listed in research.md under *Open points*.

## Project Structure

### Documentation

```text
specs/021-consistent-terminology/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/terms.md
├── checklists/requirements.md
└── tasks.md                 # created later by /speckit-tasks
```

### Source changes (in `apps/linear_regression/`)

**Backend (`backend/linreg/`)**

| File | Change |
|---|---|
| `methods.py` | **Changed.** add `Term`, `TERMS`, `term()`, `with_technical()`, `meaning()`, `BANNED`, `DEFINITIONS`, `terms_payload()`, `terms_version()`; `METHODS` names read from `TERMS` |
| `cricket_facts.py` | `METHOD_LABELS` derived from `methods`; reword the fact `meaning` strings (know-nothing → average-total guess; chosen candidate model → our pick; rival → brute-force search) |
| `cricket_blocks.py` | template sentences use `term(...)` (8 places) |
| `accuracy_text.py` | 11 places |
| `hero_text.py` | 9 places ("know-nothing guess" in the example caption) |
| `goal.py` | 9 places; verdict and rule-of-thumb wording |
| `headlines.py` | 7 places; "the brute-force search" via `term("brute_force")`; scoreboard `subject_label` from the list |
| `nodes.py` | 34 places. Pull the wording out of node bodies into pure helpers (`baseline_summary`, `grid_summary`, `final_summary`, `winner_name`, `explain_*`) so the reword script can call them. No change to any score, edge or state key (`forward_best` stays) |
| `selection.py` | `why` strings (14) read from the list; function names unchanged |
| `setup_settings.py` | `HYPERPARAMETER_NOTE`, grid note, `grid_combinations` docstring (user-visible strings only) |
| `scoring.py`, `stages.py`, `stage_info.py` | user-visible strings (row notes, stage notes) |
| `reference_api.py` | send `terms`, `definitions`, `banned`, `terms_version` (also on the failure path); `know_nothing` value shown as "average-total guess" |
| `writing_reply.py` | reject banned patterns in the model's reply (FR-005); read `BANNED` from `methods` |
| `llm_fake.py` | no change to its scripted reasoning (exempt). Its scripted writing replies are checked and reworded only if they contain a banned term, so the fake live run passes |
| `evaluation.py`, `state.py`, `run_budget.py`, `run_gate.py`, `season_split.py`, `llm_reply.py` | comments and docstrings only, no change required (FR-007); touched only if a string reaches the page |
| `prompts.py` | **Unchanged.** The prompt's structure is not in scope; it receives reworded fact meanings |

**Scripts and data**

| Path | Change |
|---|---|
| `scripts/reword_recorded_run.py` | **New.** fold events to state, rebuild every code-worded string (list in research R2), write `wording_version`, leave numbers, proposal reasons and `fingerprint` untouched; `--check` exits 1 if the file is out of date |
| `scripts/record_run.py` | writes `wording_version` when recording |
| `web/public/recorded-run.json` | rewritten once by the script (39 old-term hits) |
| `web/tests/fixtures/recorded-run.fake.json` | rewritten once by the script (test fixture) |

**Front end (`web/`)**

| Path | Change |
|---|---|
| `src/page/terms.ts` | **New.** `setTerms`, `term`, `termWithTechnical`, `meaning`, `definition` |
| `src/page/reference.ts`, `reference-types.ts` | read and pass `terms`, `definitions`, `banned` to `setTerms` |
| `src/page/recorded.ts`, `run-source.ts` | after loading the recorded file, nothing typed; names come from `terms` and the file's reworded strings |
| `src/page/final/copy.ts` (18), `view.ts` (10), `differ.ts` (3), `takeaways.ts` | method names from `term(...)`; the lead/sentence builders stay pure and take a `names` argument so unit tests can inject a list |
| `src/page/found/grid.ts` (7), `ranking.ts` (5), `view.ts` (22) | same; chart keys, table columns ("Found by"), star line, caption |
| `src/page/hero.ts`, `verdict.ts`, `verdict-bars.ts`, `tryit.ts`, `leaderboard.ts`, `round-feed.ts`, `watch.ts`, `scorebook.ts`, `catalogue.ts`, `setup.ts`, `worm.ts`, `worm-layout.ts`, `scoreboard.ts` | literal method names replaced; SVG `<title>`/`<desc>` and aria-labels included (worm chart keys "Know-nothing" → average-total guess) |
| `src/page/under-the-hood/main.ts`, `figures.ts` | render the brute-force definition, the Commentary paragraph and "Words we use" from `terms` |
| `src/page/verdict.ts` | link the first "brute-force search" to `/under-the-hood.html#brute-force` |
| `src/page/anchors.ts` | add `#brute-force` |
| `src/detail-level/detail-level.ts` | `data-region` helper `regionOf(node)` for the check's use is not needed in production; markers are added where panels are built |
| `index.html` | title and preview tags checked against the list; markup gets `data-region` on Commentary panels and the Scorebook |
| `under-the-hood.html` | part 3 gets the `#brute-force` paragraph slot and the Commentary slot; the Overview Commentary gets the "Words we use" slot; prose reworded to the list; `data-region` on Commentary panels |
| `src/page/commentary.css`, `simple.css` | styles for the definition line and the glossary `<dl>` on existing tokens |

**Tests**

| Test | Change |
|---|---|
| `tests/test_terms.py`, `test_terms_sources.py`, `test_wording_no_banned.py`, `test_reword_script.py`, `test_static_terms.py` | **New** (contract §6) |
| `tests/test_recorded_run.py` | extended with the wording check |
| `tests/test_writing_reply.py` | extended (banned term falls back) |
| 020 backend tests with old copy in assertions | update expected strings: `test_cricket_blocks`, `test_cricket_facts`, `test_hero_text`, `test_headlines`, `test_methods_goal`, `test_know_nothing` (name only; the test's subject is unchanged), `test_explanation_numbers`, `test_explanation_reference`, `test_reference_api`, `test_stage_info`, `test_stage_notes_numbers`, `test_grid_search`, `test_selection`, `test_final_test`, `test_agent_model`, `test_accuracy_text`; fixture `tests/fixtures/old_explanation_sentences.json` regenerated |
| `web/tests/unit/terms.test.ts`, `no-literal-terms.test.ts` | **New** |
| 020 unit tests with old copy | update: `final-copy`, `final-takeaways`, `final-closeness`, `final-fixtures`, `found-choice`, `found-view`, `found-fixtures`, `round-feed`, `worm`, `worm-fixtures`, `worm-layout`, `exam`, `setup`, `scoreboard`, `models` |
| `web/tests/e2e/banned-terms.spec.ts` + `banned-terms.allow.ts` | **New** (contract §5) |
| `web/tests/e2e/brute-force.spec.ts` | **New**: sentence under the graph is visible with Commentary closed, anchor works, verdict link lands on it, Commentary paragraph shows 24 and 2^19, "Words we use" lists ten rows in list order |
| 020 e2e with old copy | update: `verdict`, `scorebook`, `play`, `panels`, `stages`, `llm-run`, `contrast` (Know-nothing key), `cricket-terms`, `under-the-hood`, `hero`, `preview-tags`, `live-region` |
| `web/tests/e2e/word-count.spec.ts` | unchanged limits; add a `console.info` of the measured counts for the before/after table |
| Fixtures | `linreg-structure.json` (row note wording), `under-the-hood-reference.json` (terms added), `recorded-run.fake.json` |

## Implementation Order

0. **Baseline.** Run `word-count.spec.ts` and record the four counts per page in `quickstart.md` ("before"). Run the full suites to confirm green.
1. **Term list and backend wording.** `methods.py` list, `BANNED`, `DEFINITIONS`; `cricket_facts`, `cricket_blocks`, `accuracy_text`, `hero_text`, `goal`, `headlines`, `nodes` (helpers first), `selection`, `setup_settings`, stage strings, `reference_api`, `writing_reply`. Tests: `test_terms`, `test_terms_sources`, `test_wording_no_banned`, `test_writing_reply`; fix 020 backend assertions.
2. **Reword script and wording check.** `reword_recorded_run.py`, `record_run.py` version stamp, run the script on both recorded files, `test_reword_script`, extend `test_recorded_run`.
3. **Front end reads terms.** `terms.ts`, `reference.ts`; replace literals file by file; `no-literal-terms.test.ts` goes green last as the proof; fix 020 unit tests.
4. **Definition and "Words we use".** HTML slots, renderers, anchor, verdict link, CSS; `brute-force.spec.ts`; `test_static_terms.py`; reword the prose in `under-the-hood.html` and the title/preview tags.
5. **Region markers and banned-term check.** `data-region` on Commentary panels, Scorebook, reasoning, definitions; `banned-terms.spec.ts` (recorded and fake live run); fix any hits it finds; update 020 e2e.
6. **Word counts.** Re-measure; if How this app was built is over 500 simple or 1,200 open, cut wording in the order given in research R11 (never the spec's definition sentence); fill the "after" table.

Each step ends with pytest, Vitest and Playwright green before the next.

## Risks

- **`nodes.py` refactor (step 1)** is the riskiest backend change: the helpers must return exactly the strings the nodes return today apart from the terms. Mitigation: the 020 tests that assert node summaries run after each helper moves.
- **Rebuilding recorded strings from state (step 2)** needs every wording input to be in the recorded events. If one is not (a string built from a transient value), the script reports the path and stops; it never guesses. Fallback: record that value in `record_run.py` and re-record once.
- **Markers missed (step 5)** produce false failures ("forward selection" in a Scorebook definition flagged) or, worse, false passes. The self-test in the spec and a unit test that every `.commentary` element has `data-region` guard both.
- **Word counts (step 6)** are measured, not estimated; cuts are pre-ordered so the decision is not made under pressure.

## Implementation notes (what changed from the plan while building)

- **`backend/linreg/wording.py` (new).** The sentences the agent's steps write about themselves are pure functions here, not helpers inside `nodes.py`; `nodes.py` imports it as `phrasing` (a node has a local named `wording`). The reword script calls the same functions.
- **The reword script was proved against the recorder.** Rewording `web/tests/fixtures/recorded-run.fake.json` gives exactly the events a fresh `record_run.py --fake` run makes (`test_fake_recording.py`), and the script refuses any change to a string outside its list (`CODE_WORDED`) or to a number.
- **`terms_version` hashes only the terms and definitions** (analysis finding F6); the recorded wording itself is checked by rebuilding it.
- **"Words we use" is a closed `<details>` inside the Overview Commentary.** With the glossary open the built page was 1,383 words against the 1,200 limit; a closed `<details>` counts only its summary, as the page's other nested details do. The banned-term check and the e2e test open it.
- **Brackets (FR-002) are applied where a panel explains a method**: the Scorebook's "Every idea tried" panel (one introducer across both sections), the verdict's "Check seasons vs the final test" card, the definition and the glossary. Other Commentary panels name the plain term only, because the main page has 5 spare words at its everything-open level. This is narrower than "each Commentary panel" and is reported as a known gap.
- **Word counts** (390 px, recorded run): main simple 492 → 495, main everything 1,194 → 1,195, built simple 483 → 495, built everything 1,106 → 1,173. To fit the 47-word definition, wording was cut on "How this app was built": the hero lead's "A small web page replays it step by step.", Part 2's "as it finishes", Part 4's "without running the agent again", the Scoreboard and Commentary card sentences, and Part 5's "planned with Spec Kit"; the honest note lost a clause.
- **Left as the generic ML vocabulary:** the eight stage names and questions in the graph legend (`stages.py`, shared by every app: "Choose the candidate model", "Which features, model type and hyperparameters?"), the graph's "language model step" label, and the model picker's "Language model" label.
- **`test year` → `test season` (T036)** was done in the backend wording and the page copy; the data grid's column values and a few developer comments keep "year".
