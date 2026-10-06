# Tasks: LLM-Driven Feature Selection

**Input**: Design documents in `specs/004-llm-feature-selection/` (plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/llm-interface.md, quickstart.md)
**Tests**: Included, written before the code they cover. Every test uses the scripted fake model; **no test may reach the network**.
**Paths**: Relative to `apps/linear_regression/` unless they start with `specs/`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story label (US1 to US8), used only in story phases

**Story map** (spec.md): US1 watch a language model choose features and see why (P1); US2 the code keeps the model honest (P1); US3 forward selection and a final fair test (P1); US4 a bigger pool of candidates and three slices (P1); US5 choose which model proposes (P2); US6 protect the owner's account (P2); US7 graceful failure (P2); US8 try your own innings and the updated intro (P3).

**Build order note**: the data and catalogue (Phase 2 and US4) come first because every other story reads them. US2 is built before US1 because the proposal loop in US1 needs the proposal check. US1 ends the loop with a temporary route to the explanation; US3 inserts forward selection and the final test in front of it. The model-options module is built in Phase 2 because US1 needs a default model.

## Phase 1: Setup

- [x] T001 Baseline before any edit: `git status` (confirm what is uncommitted), then run `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test`, and record the result (expected: 139 pytest, 66 Vitest, 64 Playwright; `tests/e2e/play.spec.ts` "pressing Play again mid-run" is a known timing flake under full parallel load)
- [x] T002 Add `httpx` and `pydantic` as direct runtime dependencies in `pyproject.toml` (move `httpx` out of the dev group if it is only there), refresh `uv.lock`, re-export `requirements.txt` with `uv export` as `tests/test_boundaries.py::test_requirements_txt_matches_the_lockfile` expects, and check the production bundle still builds
- [x] T003 Spike (front end): in `web/tests/unit/layout.test.ts` add a layout test for a graph with a self-edge, then draw it with `<graph-replay>` using a throwaway structure (served with `serveStructure` from `web/tests/e2e/helpers.ts`, as `reuse.spec.ts` does) and take a screenshot. Decide: self-loop is readable (use it for `forward_selection`) or not (use a two-node loop `forward_step` and `forward_check`). Record the decision in `specs/004-llm-feature-selection/research.md` (Decision 11)
- [X] T004 Owner task, needs the owner's key (not run by tests): add `scripts/time_models.py`, which sends one typical-size prompt per model in `MODEL_OPTIONS` to OpenRouter and prints the elapsed time and token counts; the owner runs it and records which models finish a six-round run within about a minute (SC-004). Slow models are dropped from the list; no code change needed

**Checkpoint**: Baseline known; dependencies in place; the loop-drawing choice made.

## Phase 2: Foundational (blocks all user stories)

- [x] T005 [P] Write failing tests in `tests/test_recipes.py` for `backend/linreg/recipes.py`: `difference` (10 minus a column), `product` of two columns, a product of a derived column, `indicator` (column equals value, 1 or 0), a recipe naming an unknown column raises a clear error, results are integers for integer inputs
- [x] T006 Implement `backend/linreg/recipes.py`: the small interpreter over declarative recipes (`difference`, `product`, `indicator`), with `evaluate(recipe, row_or_frame)` and `inputs(recipe)` (the columns a recipe reads); make T005 pass
- [x] T007 [P] Write failing tests in `tests/test_features_catalogue.py`: exactly the 16 candidate ids from data-model.md; each has a label, description, unit and bounds; every recipe reads only earlier entries or `competition`; the dummy recipes are built from `competition_dummies.DUMMIES` (the mapping is not repeated); `inputs` resolves derived features down to measured columns (for example `runs_x_wickets_in_hand` needs `runs_at_10` and `wickets_at_10`); `PREPARED_COLUMNS` has `competition`, `is_ipl`, `is_bbl`, `venue` in that order, then the other candidates, then `final_total`; the set-size limit is 8
- [x] T008 Implement the catalogue in `backend/linreg/features.py` (id, label, description, unit, bounds, source or recipe; plain cricket wording), `PREPARED_COLUMNS`, `check_features(df)` (derived columns equal their recipes on every row; raises `DataError` with the count of wrong rows, as `check_dummies` does), and keep the existing `label()`, `unit()`, `labels()` helpers working for the old nodes; make T007 pass; update `backend/linreg/state.py` with `SET_LIMIT = 8`, `ROUND_CAP = 6`, `NO_IMPROVE_STOP = 2` (leave `FEATURE_ORDER` for now)
- [x] T009 [P] Extend `tests/fixtures/builders.py` with ball-level control: helpers to build deliveries with runs, extras (wide, no-ball, bye, leg-bye), boundaries, sixes, dots and dismissals at chosen overs and balls, and a `make_innings_from_deliveries` that keeps the existing `make_innings` working
- [x] T010 [P] Write failing tests in `tests/test_prepare_features.py` (and adjust `tests/test_prepare_dummies.py` and `tests/test_prepare_data.py` for the new columns): each measured column on hand-built innings (powerplay wickets in overs 1 to 6; runs and wickets in overs 7 to 10; fours and sixes; dot balls; extras; runs since the last wicket; legal balls since the last wicket; no dismissal at all means the partnership is the whole 10 overs); an innings whose later overs (after over 10) are wild gives identical candidate values (nothing after over 10 is used); derived columns equal their recipes; the manifest has a `features` entry; `--from-existing` on a file missing measured columns fails with a message naming them (it cannot compute them) and still refreshes the dummies and derived columns on a file that has them
- [x] T011 Update `scripts/prepare_data.py`: compute the 12 measured columns in `rollup_match` from the deliveries (definitions in research.md, Decision 7), the derived columns through `recipes.py`, `COLUMNS` from `features.PREPARED_COLUMNS`, the manifest `features` entry, and the `--from-existing` refusal; make T010 pass
- [x] T012 [P] Write failing tests: `tests/test_split.py` rewritten for `Slices` (training before the validation year, validation the second most recent year, test the most recent; never random; no overlap) and additions to `tests/test_load_data_stop.py` (fewer than 100 validation innings stops with a clear message, fewer than 100 test innings stops, a file missing a new column stops with "missing columns", a wrong derived column stops with the wrong-row count, and a blank or missing value in any candidate column stops with a message naming the column and the number of affected rows)
- [x] T013 Implement `Slices` in `backend/linreg/season_split.py` (a new `split_three_ways(df)` returning training, validation, test and the two years; keep `split_by_year` for the old nodes until Phase 5 removes it), and update `load_data` and `_load` in `backend/linreg/nodes.py` to load with `features.PREPARED_COLUMNS`, call `check_dummies` and `check_features`, and apply the minimum-innings check to validation and test; make T012 pass
- [x] T014 Update `make_table` in `tests/conftest.py` so built tables carry every candidate column (measured columns random but plausible, derived columns from `recipes.py`, dummies from `add_dummies`); confirm the existing pytest suite still passes with the old graph
- [x] T015 [P] Write failing tests in `tests/test_model_options.py` for `backend/linreg/model_options.py`: `MODEL_OPTIONS` JSON parsing (id, name, note, default), exactly one default, an invalid or missing-default config raises a clear error, the checked-in fallback list is used only when the variable is unset, lookup by opaque `choice` token, the public view has names, notes, default and tokens but never ids
- [x] T016 Implement `backend/linreg/model_options.py` with the four fallback models from research.md (Fast default `openai/gpt-6-luna`, Fast different maker `google/gemini-3.8-flash`, Balanced `anthropic/claude-haiku-4.5`, More thorough `anthropic/claude-sonnet-5.5`); make T015 pass
- [x] T017 Rebuild the data (needs the network): run `uv run python scripts/prepare_data.py`, review `git diff --stat data/` and the manifest (new download date, counts, `features` entry), and record the new row counts and the validation and test years in `specs/004-llm-feature-selection/research.md` (Decision 9). The golden-run guarantee from feature 003 is superseded, so delete `tests/fixtures/golden_run.json`, `tests/fixtures/record_golden_run.py` and `tests/test_run_unchanged.py`, and remove the checksum and download-date tests from `tests/test_dummies_real_data.py`; update that file's other tests for the new column list
- [x] T018 Run `uv run pytest`; fix anything the new data or columns broke in the old graph's tests (the old graph is replaced in Phase 5, so only fix what is cheap)

**Checkpoint**: The catalogue, recipes, slices and the rebuilt data are in place and tested.

## Phase 3: User Story 4 - A bigger pool of candidates and three slices (Priority: P1)

**Goal**: The visitor can see the candidate features with descriptions, the new columns on the Data tab and in the CSV, and the three slices.
**Independent test**: Open the Data tab and the catalogue; check columns, descriptions, "Used for" and counts.

- [x] T019 [P] [US4] Update `tests/test_data_api.py`: the columns are the catalogue's, in `PREPARED_COLUMNS` order plus `used_for`, each with the catalogue's label and description; `used_for` is `training`, `validation` or `test`, with labels Training, Validation, Test, and agrees with `split_three_ways`; the summary reports the three slices' counts and years and they equal the row counts; rows still equal `data/innings.csv` plus `used_for`
- [x] T020 [P] [US4] Write failing tests in `tests/test_api_catalogue.py` for `GET /api/catalogue` (contracts/api.md): `limit` 8; every feature with id, label, description, unit, bounds, source and `inputs`; a cache header
- [x] T021 [US4] Update `backend/linreg/data_table.py`: columns from the catalogue (labels and descriptions), the three-valued `used_for` from `split_three_ways`, a summary section for the slices (years and counts); keep `data_notes.py` consistent; make T019 pass
- [x] T022 [US4] Add `backend/linreg/catalogue_api.py` (router for `GET /api/catalogue`), mount it in `api/index.py`, and add a cache header for `/api/catalogue` in `vercel.json`; make T020 pass
- [x] T023 [P] [US4] Update `web/tests/e2e/data-tab.spec.ts` for the new columns: the column guide count equals the number of columns the API returns, the copy test spans the right columns, the download tests' header and row checks, and a new test that the "Used for" filter offers Training, Validation and Test and each shows rows from the right years; add the new columns' descriptions on focus
- [x] T024 [P] [US4] Write a failing Playwright test in `web/tests/e2e/catalogue.spec.ts`: a collapsible "What the agent can choose from" section on the Working tab lists all 16 features with their descriptions, closed by default
- [x] T025 [US4] Implement `web/src/page/catalogue.ts` (fetch `/api/catalogue`, render as text with `textContent`) and the section in `web/index.html`; wire it in `web/src/page/main.ts`; make T024 pass
- [x] T026 [US4] Run the Data tab and catalogue tests together; fix any failures

**Checkpoint**: A visitor can see the pool, the slices and the new columns. (FR-001 to FR-007, SC-009.)

## Phase 4: User Story 2 - The code keeps the language model honest (Priority: P1)

**Goal**: Pure, testable rules decide whether a proposal may be fitted.
**Independent test**: Feed `check_proposal` each kind of bad proposal and check the outcome and reason.

- [x] T027 [P] [US2] Write failing tests in `tests/test_redundancy.py` for `backend/linreg/redundancy.py`: an independent set passes; `wickets_in_hand` with `wickets_at_10` is redundant and both are reported; `runs_at_10` with `powerplay_runs` and `runs_overs_7_10` is redundant and all three are reported (on the real training data); a constant column is reported; the reported features are in plain wording; the check uses the intercept (columns plus intercept not linearly independent); a single feature is never redundant unless constant
- [x] T028 [US2] Implement `backend/linreg/redundancy.py` per research.md, Decision 8 (rank of `[1, X]` by SVD with relative tolerance 1e-9; drop-one test to report the features involved); make T027 pass
- [x] T029 [P] [US2] Write failing tests in `tests/test_llm_reply.py` for `backend/linreg/llm_reply.py`: plain JSON; JSON inside a markdown code fence (with and without the word json); prose before and after the braces; extra keys ignored; `finished` defaults to false; missing `features` or `reason`, wrong types, non-JSON text and an empty reply raise `UnusableReply`; the reason is returned exactly as given (spaces, quotes, markup untouched)
- [x] T030 [US2] Implement `backend/linreg/llm_reply.py` (`parse_reply`, the pydantic model, `UnusableReply`) with the three-step defensive parsing from the brief; make T029 pass
- [x] T031 [P] [US2] Write failing tests in `tests/test_check_proposal.py` for `check_proposal` in `backend/linreg/selection.py`: unknown name, wrong capitalisation, empty set, more than 8, a repeat of a tried set in a different order, a redundant set (reason names the repeating features), a good set passes; the first failing rule's reason is returned in the order given in plan.md; each rejection says why in plain language; rejections count towards the round cap
- [x] T032 [US2] Implement `check_proposal` (and the round and no-improvement helpers it needs) in `backend/linreg/selection.py`, using `features` for exact-name matching and `redundancy` on the training data; make T031 pass

**Checkpoint**: The rules are tested without any model. (FR-015, FR-016.)

## Phase 5: User Story 1 - Watch a language model choose features, and see why (Priority: P1)

**Goal**: The loop `propose_features → check_proposal → fit_model → evaluate` runs, shows each proposal and its reason, and the visitor sees the nodes, the leaderboard and the model's reasoning.
**Independent test**: Run the graph with the scripted fake and check the sequence of events, the stopping rules and the numbers.

- [X] T033 [P] [US1] Write failing tests in `tests/test_llm_client.py` for `backend/linreg/llm_client.py` using `httpx.MockTransport` (no network): the request goes to the OpenRouter chat completions URL with a bearer header from `OPENROUTER_API_KEY`, the model id, `max_tokens`, a low temperature and a JSON-schema `response_format`; a host that rejects `response_format` gets one retry without it; a timeout raises `LlmTimeout`; an error status or a missing key raises `LlmUnavailable` (a missing key makes no request at all); the key never appears in any raised message or log record (it is replaced with `[redacted]`); the reply text is returned
- [X] T034 [US1] Implement `backend/linreg/llm_client.py`: the `LlmClient` protocol, `LlmRequest`, `LlmUnavailable`, `LlmTimeout`, `OpenRouterClient` (httpx), and key redaction (contracts/llm-interface.md); make T033 pass
- [X] T035 [P] [US1] Write failing tests in `tests/test_prompts.py` for `backend/linreg/prompts.py`: the system message states the task, the rules, the JSON shape, the limit of 8 and the rounds remaining; the user message has the catalogue (id, label, description, unit), the training-only statistics, the attempt history with validation errors, and the rejections with reasons; it contains no validation rows and no test-year number
- [X] T036 [US1] Implement `backend/linreg/prompts.py`; make T035 pass
- [X] T037 [US1] Implement `backend/linreg/llm_fake.py`: `FakeLlm(script)` returning scripted replies by model id and call number, recording every `LlmRequest`, able to produce a good sequence, an unknown feature, an empty set, a repeat, nine features, a redundant set, a code-fenced reply, prose around JSON, non-JSON, a timeout, an outage and "finished" on the first call; plus the default script used when `LLM_PROVIDER=fake` (a deterministic, sensible sequence per model id, including one fake model id that always fails and one whose reason contains HTML markup)
- [X] T038 [P] [US1] Write failing tests in `tests/test_agent_run.py` using `FakeLlm`: the node order `load_data, split, explore, baseline, propose_features, check_proposal, fit_model, evaluate, …`; a proposal's event holds the features and the reason verbatim; each evaluation holds the validation error and `improved`; the loop ends on the model's "finished", on two rounds in a row with no improvement, and on the round cap of six (rejections counted); `explore` and `baseline` use training and validation data only; every number in the state comes from code (fitted values equal an independent numpy fit); the leaderboard data (`attempts`, `rounds`) grows step by step
- [X] T039 [US1] Rewrite `backend/linreg/state.py` (new state keys from data-model.md plus an accumulating `rounds` list, remove `FEATURE_ORDER`, update `RECURSION_LIMIT`), `backend/linreg/nodes.py` (`split` with three slices, `explore` after split using training years only, `baseline` scoring the TV projection on the validation year, `propose_features` using the injected client and the run's model id from the run config, `check_proposal` node, `fit_model` on training years, `evaluate` on the validation year; remove `tune`), and `backend/linreg/graph.py` (new shape and routers; `build_graph(client)`; a **temporary** stop route from `evaluate` straight to `explain_in_cricket_terms`, to be replaced in Phase 6); remove `split_by_year`; make T038 pass. Expected: many old tests are red from here until T040 and T041 are done (T040 is not optional); at this point only the new tests must pass
- [X] T040 [US1] Remove or rewrite the old tests that assume the fixed three-feature loop (research.md, Decision 14): `tests/test_nodes.py`, `tests/test_routing.py`, `tests/test_termination.py`, `tests/test_baseline.py`, `tests/test_explanation_numbers.py`, `tests/test_real_data.py`, `tests/test_api.py`, and any use of `FEATURE_ORDER` or `split_by_year`; keep `tests/test_regression.py` and the load-data stop tests working
- [X] T041 [US1] Update `backend/linreg/graph_api.py` (stays generic): `create_router` accepts `node_meta` and puts each node's `actor` (`"llm"` or `"code"`) into `/api/structure`; update `specs/001-linear-regression-agent/contracts/structure.schema.json` to allow `actor`; add an `actor` test in the rewritten `tests/test_api.py`; mark only `propose_features` as `llm`
- [X] T042 [US1] Update `api/index.py` to build the client (`FakeLlm` when `LLM_PROVIDER=fake`, otherwise `OpenRouterClient`) and the run config with the default model from `model_options.py`, and pass them to `build_graph` and the router
- [X] T043 [P] [US1] Generic visualiser change for the language-model step: add an optional `actor` to the structure types in `web/src/graph-replay/layout.ts`, give `actor: "llm"` nodes a different fill and a small "LLM" tag in `web/src/graph-replay/graph-replay.ts` and `styles.ts` (no app knowledge), add `actor` to `web/tests/fixtures/other-structure.json`, and tests: Vitest for the types and a Playwright check in `web/tests/e2e/reuse.spec.ts` that the node looks different
- [X] T044 [US1] Update `web/playwright.config.ts` so the API server starts with `LLM_PROVIDER=fake`, `RATE_LIMIT_STORE=memory`, a `MODEL_OPTIONS` listing the fake models (a good one as default, a second good one, one that always fails, one whose reason contains HTML markup), `RUN_LIMIT_PER_HOUR=5`, a very high daily cap (so the suite never meets it), and a short run deadline; document it in the file. The in-memory store starts empty with every server start, so a reused dev server can carry counts between runs; say so in the file and have the refusal test tolerate it by using its own visitor
- [X] T044a [US1] Give every Playwright test its own visitor, because every test otherwise reaches the server from the same address and would be refused after a few runs: add `web/tests/e2e/fixtures.ts` exporting a `test` (built with `test.extend`) whose context sends a unique `X-Forwarded-For` header per test, and change every spec in `web/tests/e2e/` to import `test` and `expect` from it instead of from `@playwright/test`; run the whole existing suite to confirm no refusals
- [X] T045 [P] [US1] Write failing Playwright tests in `web/tests/e2e/llm-run.spec.ts` (first part): the `propose_features` node is drawn differently from the code nodes; each proposal's event shows the features and the reason labelled as the model's reasoning; each evaluation shows the validation error and whether it improved; the leaderboard builds step by step; a reason containing `<b>` and `<script>` is shown as plain text
- [X] T046 [US1] Implement the visitor-facing pieces: `web/src/page/leaderboard.ts` (the leaderboard from `state.attempts` and a rounds list from `state.rounds`, with the model's reason in a clearly labelled "The model's reasoning" block inserted with `textContent`), the containers in `web/index.html`, and the wiring in `web/src/page/main.ts` and `results.ts` for the temporary end state; make T045 pass
- [X] T047 [US1] Update the existing Playwright specs that assumed the old graph so they match the new graph: delete `web/tests/e2e/tune.spec.ts` and the "pressing Play again" test in `play.spec.ts`; update `structure.spec.ts`, `panels.spec.ts`, `navigate.spec.ts`, `explanation.spec.ts` and `tryit.spec.ts` as needed (expected step paths and labels); keep everything else

**Checkpoint**: The proposal loop runs end to end against the fake model and the page shows it. (FR-008 to FR-010, FR-017, FR-024 to FR-026.)

## Phase 6: User Story 3 - A mechanical rival and a final fair test (Priority: P1)

**Goal**: Forward selection runs in the same graph; the test year is scored once per contender; results compare the three errors and name the winner.
**Independent test**: Run with the fake model and check the three test-year errors, the winner and the explanation numbers against independent calculations.

- [X] T048 [P] [US3] Write failing tests in `tests/test_selection.py` for forward selection: it adds the single feature that most reduces validation error, one per step; it stops when nothing helps or at 8 features; it skips any addition that makes the set redundant; the first addition (from an empty set) is always taken, even if the best single feature does little, and the results say so when it is the only feature; a later stop means no further feature lowers validation error; ties are broken deterministically (catalogue order); it uses only training and validation data
- [X] T049 [US3] Implement the forward-selection step in `backend/linreg/selection.py`; make T048 pass
- [X] T050 [P] [US3] Write failing tests in `tests/test_final_test.py`: the test slice is read exactly once per contender (the language model's best set, forward selection's set, the TV projection) and only inside `final_test`; the winner is the lower test error with ties to forward selection; `beat_tv` needs the 3-run margin; the result holds the three errors, the winner and the margin; with no language-model set the winner is forward selection
- [X] T051 [US3] Add the `forward_selection` and `final_test` nodes in `backend/linreg/nodes.py` and wire them in `backend/linreg/graph.py` (a self-loop for `forward_selection` if T003 found it readable, otherwise `forward_step` and `forward_check`), replacing the temporary route from Phase 5; update the node metadata and the structure test; make T050 pass
- [X] T052 [P] [US3] Rewrite `tests/test_explanation_numbers.py`: every number in the explanation sentences and comparison is present in the state (computed by code); the explanation names the winning approach, the margin, and whether the winner beat the TV projection; it states plainly when the language model did not take part
- [X] T053 [US3] Rewrite `backend/linreg/cricket_explanation.py` to explain the winner and which approach won and by how much, from state only; make T052 pass
- [X] T054 [P] [US3] Write `tests/test_no_test_year_leak.py` (SC-003): changing every test-year value changes no prompt the fake receives, no attempt, no rejection and no chosen set; a spy on the slices shows the test slice is touched only in `final_test`
- [X] T055 [P] [US3] Write `tests/test_catalogue_only.py` (SC-002): across many scripted and randomly generated replies, including hostile ones (other names, wrong case, duplicates, nine features), no fitted set ever contains a name outside the catalogue
- [X] T056 [P] [US3] Write failing Playwright tests in `web/tests/e2e/llm-run.spec.ts` (second part): forward selection steps appear and the leaderboard marks who proposed each attempt; the final results show three test-year errors (the language model's choice, forward selection, the TV projection), name the winner and the margin, and say which model ran
- [X] T057 [US3] Rewrite `web/src/page/results.ts` for the three-way comparison, the winner, the margin and the model used; make T056 pass

**Checkpoint**: The full graph runs and is judged fairly. (FR-011 to FR-014, FR-027, SC-001 to SC-003.)

## Phase 7: User Story 5 - Choose which language model proposes (Priority: P2)

**Goal**: The visitor picks from the owner's list; nothing outside the list can be called; the key is never exposed.
**Independent test**: Pick each listed model, then send an unlisted one.

- [X] T058 [P] [US5] Write failing tests in `tests/test_api_models.py`: `GET /api/models` returns names, notes, the default and tokens, no ids and no key; `/api/run` with no `model` uses the default; a `model` value not in the list (including an altered token, an empty string and a raw model id) is refused with HTTP 400 `model_not_allowed` and the fake client records zero calls; a model the owner removed from the list between page load and Play is refused the same way, with a message that offers the default (FR-022); the chosen model's id is passed through the run config and only its friendly name appears in state
- [X] T059 [P] [US5] Write `tests/test_key_never_leaks.py`: with a recognisable key set, search every response body, header, SSE event, state value, log record and exception text from `/api/models`, `/api/catalogue`, `/api/run` (success, refused and failed runs) and `/api/data` for the key (SC-006)
- [X] T060 [US5] Implement `backend/linreg/run_gate.py` (model check and the run config), add the `admit` and `run_config` hooks to `backend/linreg/graph_api.py` (refusal as JSON with a status and a `Retry-After` header), add `GET /api/models` and the `model` parameter to `/api/run` in `api/index.py`, and a `public, s-maxage=300` cache header for `/api/models` in `vercel.json`; make T058 and T059 pass
- [X] T061 [P] [US5] Write failing Playwright tests in `web/tests/e2e/llm-run.spec.ts` (third part): the picker lists the models with a name and a one-line note and one preselected; Play without choosing uses the default; the results show which model ran; changing the picker during a run does not affect that run; when the server refuses a model that is no longer listed (simulated by changing what `/api/models` and `/api/run` return), the page tells the visitor, reloads the list and preselects the default (FR-022)
- [X] T062 [US5] Implement `web/src/page/models.ts` (the picker from `/api/models`, sets the `run-url` with the chosen token) and its container in `web/index.html`; show the model's friendly name in the results; on a `model_not_allowed` refusal show a clear message, reload `/api/models` and preselect the default; make T061 pass

**Checkpoint**: Model choice works and is enforced on the server. (FR-019 to FR-023, SC-006.)

## Phase 8: User Story 6 - Protect the site owner's account (Priority: P2)

**Goal**: Limits are checked before any model call; Play is disabled during a run; refusals are clear.
**Independent test**: Exceed each limit in turn and read the message; check zero model calls.

- [X] T063 [P] [US6] Write failing tests in `tests/test_limit_store.py` for `backend/linreg/limit_store.py`: the in-memory store (counters with expiry using a fake clock, lock with expiry); the Upstash store sends the expected `/pipeline` commands (INCR with EXPIRE NX, SET NX EX, DEL) with the bearer token using `httpx.MockTransport`; an unreachable or failing store raises `StoreUnavailable`; no store configured behaves as unreachable unless `RATE_LIMIT_STORE=memory`
- [X] T064 [US6] Implement `backend/linreg/limit_store.py` (Upstash REST over httpx, in-memory store for development and tests, selection from environment variables); make T063 pass
- [X] T065 [P] [US6] Write failing tests in `tests/test_run_gate.py`: each refusal (run in progress, hourly limit, daily cap) returns the right status, `reason`, a message saying when to try again and a `Retry-After`, and the fake client records zero calls; a refused start leaves no lock and no counter; the lock is released when the run ends and when the client disconnects, and expires by itself; the visitor id comes from the first `X-Forwarded-For` address, hashed (the address is never logged or returned); the store being unreachable gives a permit with the model not allowed and a reason, and the run still completes with forward selection only; `RunBudget` caps calls per run (`LLM_MAX_CALLS`), gives each call a timeout that fits the remaining time and a reserve, allows one retry only if the budget covers it, and every call carries `max_tokens`; reaching the daily cap while a run is in progress does not stop that run (only new starts are refused)
- [X] T066 [US6] Complete `backend/linreg/run_gate.py` (limits, lock, permit with `release()` called in a `finally`, `RunBudget` and the deadline recorded once at the top of the run handler), wire the hooks in `api/index.py`, apply the limits from the environment variables with the spec's defaults, hash the visitor address with `VISITOR_ID_SECRET` (if unset, use a random per-process value and log once that ids will not survive restarts), set `maxDuration` to 90 in `vercel.json`, and make T065 pass
- [X] T067 [P] [US6] Write failing tests for the generic front-end changes: `web/tests/unit/sse.test.ts` (a non-2xx response with a JSON body calls a new `onRefused(message)` and does not call `onDisconnect`; a 2xx stream behaves as before) and Playwright tests in `web/tests/e2e/llm-run.spec.ts` (fourth part): Play and Reset are disabled while a run is in progress and enabled again after; a refused start (the per-visitor hourly limit: that test makes 6 starts with its own visitor header from the T044a fixture, so the sixth is refused) shows the message and keeps the earlier results visible
- [X] T068 [US6] Implement the generic changes in `web/src/graph-replay/sse.ts` (read a refusal body, `onRefused`, open the buffer only after a 2xx) and `web/src/graph-replay/graph-replay.ts` (disable Play and Reset while a stream is open, show the server's refusal message, no abort-and-restart); update `web/src/graph-replay/README.md`; make T067 pass

**Checkpoint**: The owner's account is protected and refusals are clear. (FR-031, FR-032, SC-007.)

## Phase 9: User Story 7 - Graceful failure when the model misbehaves (Priority: P2)

**Goal**: Any model failure ends the model's part, and the run still completes with forward selection and says so.
**Independent test**: Make the fake fail in each way and check the run completes.

- [X] T069 [P] [US7] Write failing tests in `tests/test_failure_paths.py`: unavailable, timeout, an unusable reply and "finished" before any set was fitted each show a clear failure step, route to forward selection, and the results say the language model did not take part; a failure after some rounds keeps the language model's best set so far and shows the failure; the limit store being unreachable gives `llm_status: "not_used"`; every failure is logged on the server with the elapsed time and the model id and never the key (check with `caplog`); the run still reaches `explain_in_cricket_terms`
- [X] T070 [US7] Implement the failure branches in `backend/linreg/nodes.py` and the routers in `backend/linreg/graph.py` (`propose_features` catching `LlmUnavailable`, `LlmTimeout`, `UnusableReply` and a spent budget; `llm_status`, `llm_failure`; the `failed` route from `check_proposal`), with server logging; make T069 pass
- [X] T071 [P] [US7] Write failing Playwright tests in `web/tests/e2e/llm-run.spec.ts` (fifth part): choosing the always-failing fake model shows a clear failure on the proposal step, forward selection still completes, and the results say plainly that the language model did not take part; when the connection drops mid-run the received steps remain viewable (the existing dropped-connection behaviour)
- [X] T072 [US7] Show the failure and the "did not take part" message in `web/src/page/results.ts` and `leaderboard.ts`; make T071 pass

**Checkpoint**: A flaky model never ruins a run. (FR-033, FR-034, SC-008.)

## Phase 10: User Story 8 - Try your own innings and an up-to-date intro (Priority: P3)

**Goal**: The form asks for the winning model's inputs only; the intro and notes match the new agent.
**Independent test**: Finish a run, use the form, read the page text.

- [X] T073 [P] [US8] Add a backend test that writes the shared recipe fixture: `tests/test_recipe_fixture.py` computes, with `recipes.py`, a set of inputs and the expected values for every derived catalogue feature and writes (or checks) `web/tests/fixtures/recipe_cases.json`
- [X] T074 [US8] Implement `web/src/page/recipes.ts` (the small TypeScript interpreter of the same recipes, working on the catalogue from `/api/catalogue`) and `web/tests/unit/recipes.test.ts` that feeds it the fixture from T073 and expects identical results
- [X] T075 [P] [US8] Write failing Vitest tests in `web/tests/unit/predict.test.ts`: for a given winning feature set the form needs exactly the base measurements those features depend on (derived values are not asked for), with bounds from the catalogue; competition is offered as a choice that sets both dummies; validation messages for out-of-range and non-numeric input; prediction equals the winner's coefficients applied to measured plus derived values
- [X] T076 [US8] Rework `web/src/page/predict.ts` and `web/src/page/tryit.ts` to build the form from the winning model's features and the catalogue and predict with `recipes.ts`; update the form container in `web/index.html`; make T075 pass
- [X] T077 [P] [US8] Write failing Playwright tests: after a run the form shows only the winning model's inputs, a valid entry gives a prediction beside the TV projection, invalid input shows a message and no prediction (update `web/tests/e2e/tryit.spec.ts`); and the page text says the agent uses a language model to decide what to try and that numbers still come from code, with a note that runs can differ each time and that this is expected (`web/tests/e2e/llm-run.spec.ts`, sixth part)
- [X] T078 [US8] Update the intro and add the "runs can differ" note in `web/index.html` (the existing text keeps its test ids); make T077 pass

**Checkpoint**: Every story works. (FR-028 to FR-030.)

## Phase 11: Polish and cross-cutting

- [X] T079 Update `tests/test_boundaries.py`: the new language-model, gate and limit modules are app-specific (shared modules such as `graph_api.py` and `data_loading.py` import none of them); `graph_api.py` and `season_split.py` stay generic; the reusable web modules (`graph-replay`, `tab-set`, `data-grid`) still mention nothing about cricket, regression, the language model or OpenRouter
- [X] T080 [P] Update docs: `apps/linear_regression/README.md` (the agent, the catalogue, the configuration variables, how to run with the fake model, how to rebuild the data), `web/src/graph-replay/README.md` (the `actor` field, disabled Play and Reset, refusals), and `specs/004-llm-feature-selection/data-model.md` (the accumulating `rounds` state key added during implementation)
- [X] T081 Run everything: `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test`, `cd web && npm run build`; confirm no test reached the network (run once with the network blocked) and that the previously known flaky test is the only intermittent one
- [X] T082 Walk through `specs/004-llm-feature-selection/quickstart.md` with the fake model, including the refusal after five starts in an hour and the run with no key
- [ ] T083 Owner task, needs the owner's key and accounts: set `OPENROUTER_API_KEY`, `MODEL_OPTIONS` (after T004's timings), `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the Vercel project (encrypted, server only), deploy, run once per listed model, and confirm a run completes in about a minute (SC-004), the limits refuse when expected, and no key appears in any response
- [X] T084 Reader review (SC-005): someone unfamiliar with the project reads the page after a run and says which model ran, what it proposed each round and why, and whether it beat forward selection; record the outcome in `specs/004-llm-feature-selection/checklists/requirements.md` notes
- [X] T085 Security check: search the repository and the built site for the key's name and any key-like strings (`git grep`, the `web/dist` output), confirm `.env` files are ignored by git, and confirm `LLM_PROVIDER` and `RATE_LIMIT_STORE` are not set in `vercel.json`

## Dependencies and order

- Phase 1, then Phase 2 (blocks everything). T012 and T015 before T013 and T016; T017 (the data rebuild, needs the network) after T011 and T013.
- US4 needs Phase 2. US2 needs Phase 2 (and uses the rebuilt data). US1 needs US2 (T032) and Phase 2 (T016). US3 needs US1. US5 needs US1. US6 needs US5 (the `admit` hook) and US1's front-end wiring. US7 needs US1 and US6's budget. US8 needs US3 (the winner) and US4 (the catalogue).
- The unique ordering constraint inside US1: T039 (graph rewrite) before T040 and T041, T042; T044 (e2e server env) before any Playwright run of the new graph.
- Polish last.

Order of delivery: Phase 1, Phase 2, US4, US2, US1, US3, then US5, US6, US7, US8, then Polish.

## Parallel examples

- Phase 2: T005, T007, T009 and T010 together (different files); T012 and T015 together.
- US4: T019, T020, T023 and T024 together once Phase 2 is done.
- US2: T027, T029 and T031 together.
- US1: T033, T035, T038 and T043 together (T043 is front end only).
- US3: T048, T050, T052, T054, T055 and T056 together.
- US5 to US8: the test tasks within each phase (T058 and T059; T063 and T065; T069 and T071; T073 and T075) together.

## Implementation strategy

1. **Safe first steps**: T001 to T004. T003 (the self-loop spike) and T004 (timing) answer two open questions before anything depends on them.
2. **Data first**: Phase 2 and US4 produce a verified catalogue and a rebuilt table. Stop and review the data diff (T017) before building on it.
3. **Honest core**: US2 (rules), US1 (loop and visuals), US3 (rival and final test) give a complete, fair run against the fake model. This is the minimum worth demoing.
4. **Make it safe to publish**: US5 (model list), US6 (limits), US7 (failure handling) are required before the page is public, because runs cost money.
5. **Finish**: US8, then polish and the owner tasks (T004, T083, T084).
6. Throughout: no test reaches the network; the key appears nowhere but the client's request header.

## Task counts

| Phase | Tasks |
|---|---|
| Setup | 4 (T001 to T004) |
| Foundational | 14 (T005 to T018) |
| US4 Pool and slices | 8 (T019 to T026) |
| US2 Honest rules | 6 (T027 to T032) |
| US1 Proposal loop | 16 (T033 to T047, T044a) |
| US3 Rival and final test | 10 (T048 to T057) |
| US5 Model choice | 5 (T058 to T062) |
| US6 Account protection | 6 (T063 to T068) |
| US7 Failure handling | 4 (T069 to T072) |
| US8 Try your own and intro | 6 (T073 to T078) |
| Polish | 7 (T079 to T085) |
| **Total** | **86** |
