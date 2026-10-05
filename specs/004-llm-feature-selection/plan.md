# Implementation Plan: LLM-Driven Feature Selection

**Branch**: `004-llm-feature-selection` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification plus the technical decisions supplied with `/speckit-plan`. The pasted brief ended mid-sentence in its Playwright list; I read the missing items as: a refusal message is shown when a start is refused, the final three-way comparison appears, and the model's reason is shown as plain text.

## Summary

The fixed three-feature loop is replaced. A deterministic graph of code steps surrounds one language-model step: `load_data → split → explore → baseline → propose_features → check_proposal → fit_model → evaluate`, looping back to `propose_features` until a stopping rule fires, then `forward_selection` (code only, one step per feature added), `final_test` (the only reader of the test year) and `explain_in_cricket_terms`. The language model is reached through a tiny injected interface (OpenRouter over `httpx`; a scripted fake in every test and in the e2e server). A 16-feature catalogue, defined once as data, is computed by the preparation script from the ball-by-ball data, shown to the visitor and given to the model. Redundant feature sets are detected numerically. Data is split into training, validation and test years. Runs are admitted by a gate: owner-set model list, per-visitor hourly limit, daily cap, one-run-at-a-time lock (Upstash Redis over REST), all checked before any model call and failing closed to forward-selection-only.

## Technical Context

**Language/Version**: Python 3.12 (backend, script); TypeScript (web)
**Primary Dependencies**: Existing: LangGraph, FastAPI, pandas, numpy, Tabulator, dagre. New direct dependencies: `httpx` (HTTP to OpenRouter and Upstash; already installed for tests) and `pydantic` (reply validation; already pulled in by FastAPI). No LLM SDK, no Redis SDK, no new web dependency
**Storage**: Committed `data/innings.csv` (now 16 candidate columns) and `data/manifest.json`; Upstash Redis (counters and lock only) in production; no database
**Testing**: pytest, Vitest, Playwright, all against a scripted fake model; no test reaches the network
**Target Platform**: Vercel (static plus Python function, `maxDuration` 90); evergreen browsers
**Project Type**: Web app inside the uv-workspace monorepo (as 001 to 003)
**Performance Goals**: A run with the default model finishes in about a minute or less (SC-004); code steps take milliseconds
**Constraints**: Key only from `OPENROUTER_API_KEY`, never in state, events, responses, logs or messages; reply length and calls per run capped; the test year is read only inside `final_test`; function bundle stays small (no new SDKs)
**Scale/Scope**: About 5,200 innings, 16 candidates, at most 8 per set, at most 6 rounds, 4 models, public traffic with a daily cap

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief instead: numbers come only from code, the model's choices are checked by code, the test year plays no part in choosing, the key never leaves the server, reusable web modules stay free of app knowledge, one definition per formula.

**Re-check after design**: no violations. Two departures from the brief's wording are flagged in research.md: the node-type field is named `actor` (the existing `kind` field already means start/end/node), and Reset is disabled while a run is in progress (otherwise it could orphan a server run).

## Project Structure

### Documentation (this feature)

```text
specs/004-llm-feature-selection/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── llm-interface.md
└── checklists/requirements.md
```

### Source Code (additions and changes under `apps/linear_regression/`)

```text
backend/linreg/
├── features.py              # CHANGED: the catalogue (id, label, description, unit, bounds, source/recipe)
├── recipes.py               # NEW: interpreter for the declarative recipes (difference, product, indicator)
├── season_split.py          # CHANGED: three slices (Slices value); shared-library candidate stays generic
├── redundancy.py            # NEW: numeric redundancy check, reports which features repeat
├── selection.py             # NEW: pure functions: validation scoring, forward-selection step, stopping rules
├── llm_client.py            # NEW: LlmClient protocol, OpenRouterClient (httpx), key redaction
├── llm_reply.py             # NEW: defensive parse + pydantic validation, UnusableReply
├── llm_fake.py              # NEW: scripted FakeLlm for tests and the e2e server (LLM_PROVIDER=fake)
├── prompts.py               # NEW: builds the system and user messages from the catalogue, statistics and history
├── model_options.py         # NEW: MODEL_OPTIONS parsing, fallback list, lookup, public view
├── run_gate.py              # NEW: admission (model check, limits, lock) and the run config
├── limit_store.py           # NEW: Upstash REST store, in-memory store (dev/test), fail-closed
├── nodes.py                 # CHANGED: new node functions; old tune/FEATURE_ORDER logic removed
├── graph.py                 # CHANGED: new graph shape, routing, node metadata
├── state.py                 # CHANGED: constants (caps, limit of 8, margin), new state keys, no FEATURE_ORDER
├── cricket_explanation.py   # CHANGED: explains the winner, states which approach won and by how much
├── graph_api.py             # CHANGED, stays generic: admit/run_config hooks, node_meta, refusal responses
├── data_table.py            # CHANGED: columns and "Used for" (three values) from the catalogue and slices
├── data_notes.py            # CHANGED: note text updated for the extra candidate features (dummies unchanged)
└── competition_dummies.py   # unchanged (still the one definition of the dummy mapping)
api/index.py                 # CHANGED: wires the client, model list, gate, /api/models, /api/catalogue
scripts/prepare_data.py      # CHANGED: ball-by-ball measures, derived columns, manifest "features" entry,
                             #   --from-existing refuses the new columns with a clear message
vercel.json                  # CHANGED: maxDuration 90; /api/models and /api/catalogue cache headers
pyproject.toml, requirements.txt  # CHANGED: httpx and pydantic as direct runtime dependencies
tests/
├── conftest.py              # CHANGED: make_table has all candidate columns; fake-LLM helpers
├── fixtures/builders.py     # CHANGED: ball-level builders for the new measures
├── test_features_catalogue.py, test_recipes.py, test_redundancy.py, test_selection.py,
│   test_check_proposal.py, test_llm_reply.py, test_llm_client.py, test_prompts.py,
│   test_model_options.py, test_run_gate.py, test_limit_store.py, test_agent_run.py,
│   test_failure_paths.py, test_no_test_year_leak.py, test_key_never_leaks.py,
│   test_prepare_features.py, test_api_models.py   # NEW
└── (rewritten) test_nodes, test_routing, test_termination, test_split, test_baseline,
    test_explanation_numbers, test_real_data, test_load_data_stop, test_data_api, test_api
    (removed) test_run_unchanged.py and fixtures/golden_run.json
web/
├── src/graph-replay/        # CHANGED, generic only: actor styling, Play/Reset disabled while running,
│                            #   refusal handling (onRefused), self-loop drawing
├── src/page/
│   ├── main.ts              # CHANGED: wire the picker, catalogue, leaderboard, results
│   ├── models.ts            # NEW: model picker (GET /api/models), sets run-url
│   ├── catalogue.ts         # NEW: shows the catalogue; recipes.ts: TS recipe interpreter
│   ├── leaderboard.ts       # NEW: builds from state.attempts
│   ├── results.ts           # CHANGED: three-way comparison, who ran, language-model-did-not-take-part
│   ├── predict.ts, tryit.ts # CHANGED: form built from the winning features and the catalogue
│   └── (index.html: intro, "runs can differ" note, picker, leaderboard containers)
└── tests/
    ├── unit/                # recipes.test.ts, predict.test.ts (form inputs), layout.test.ts (self-loop)
    └── e2e/                 # llm-run.spec.ts (new); existing specs updated or removed (Decision 14)
    playwright.config.ts     # CHANGED: webServer env: LLM_PROVIDER=fake, MODEL_OPTIONS, limits, memory store
```

**Structure decision**: all decisions about *what to try* and *what is allowed* are code and testable without a model: `selection.py`, `redundancy.py`, `check_proposal`. The model touches the system in exactly one place (`propose_features` through `LlmClient`), and the only things that cross that boundary are a prompt out and text back.

## Design Notes

### Graph (`graph.py`)

```text
load_data ─ok→ split → explore → baseline → propose_features → check_proposal
   └stop→ END                                   ▲   ▲      │ fit            │ rejected → propose_features
                                                │   │      ▼                │ finished/failed → forward_selection
                                                │   └─ evaluate ◄─ fit_model
                                                │        │ continue → propose_features
                                                │        │ stop     → forward_selection
forward_selection ⟲ (until nothing helps or 8 features) → final_test → explain_in_cricket_terms → END
```

- `propose_features` (actor `llm`): builds the prompt, calls the injected client with the run's model id and the remaining budget, parses and validates the reply. On `Unavailable`, `Timeout`, `UnusableReply` or no budget left it writes a `llm_failure` note and the router sends the run on to forward selection.
- `check_proposal` (code): applies every FR-015 rule in this order and records the first reason: unknown name (exact match to the catalogue, so wrong capitalisation fails), empty, more than 8, already tried (as a set), redundant (numerical). Routes to `fit`, `rejected` (a rejection counts as a round), `finished` (the model said so, and at least one set has been fitted; `finished` before any fit is the failure path) or `failed`.
- `fit_model` (code): fit on the training years only. `evaluate` (code): score on the validation year; mark `improved` against the best so far; decide `continue` or `stop` (the model said finished, two rounds in a row with no improvement, or the round cap of six, counting rejections).
- `forward_selection` (code): each visit tries every candidate not yet in the set, skipping ones that make the set redundant or exceed 8, adds the one with the lowest validation error, appends an attempt marked `forward_selection`, and loops while that beats the previous best.
- `final_test` (code): refit each contender's set on the training years if needed, score the language model's best set, forward selection's set and the TV projection on the test year once each, pick the winner (Decision 12) and store all three errors.
- `explain_in_cricket_terms` (code): builds sentences only from state numbers; adds which approach won and by how much, and says plainly if the language model did not take part.

State carries plain data only: attempts, rejections, the best sets, the model's friendly name, and flags. Never the key, the model id's credentials, or raw replies beyond the model's own `reason` text.

### The gate and the run (`run_gate.py`, `graph_api.py`)

`GET /api/run?model=<id>`: the handler records `started`, calls `admit(request)`, then streams `run_events(...)`. `admit` checks the model against the owner's list, then the lock, the hourly counter and the daily counter (research.md, Decision 4). A refusal is returned as JSON with HTTP 400 or 429 and a `Retry-After` header, before any model call. A permit holds the model id, `llm_allowed` and `release()`; `run_events` calls `release()` in a `finally`, so the lock goes when the stream ends or the client disconnects. If the store is unreachable the permit has `llm_allowed=False` and a reason, which the graph shows as the failure path.

### Front end

- `<graph-replay>` (generic): `actor` styling; while a stream is open Play and Reset are disabled and a status line says a run is in progress; `streamRun` handles a refusal by showing its message and leaving the buffer alone; the layout draws self-edges.
- Page code (app-specific): the picker reads `/api/models` and sets `run-url`; the leaderboard is built from `state.attempts` as steps arrive; the results area shows the three test-year errors, the winner, the model used and a plain "the language model did not take part" when that applies; the model's reason is inserted with `textContent`; the intro and the "runs can differ" note are updated in `index.html`.
- Try your own innings: the form lists the base measurements the winning features need (found by following recipes down to measured columns), with bounds from the catalogue, a competition choice that sets the dummies, and derived values computed with `recipes.ts`.

### Data and splits

The script computes the 12 measured columns per innings (research.md, Decision 7), then the derived columns through `recipes.py`, writes them in catalogue order, and records a `features` entry in the manifest. On load the backend verifies the derived columns against the recipes and the dummies against their mapping (as in feature 003). `season_split` returns training, validation and test slices; `data_table.py` labels each row Training, Validation or Test; row counts agree between the summary, the grid and the agent's steps.

### Time budget

`/api/run` records `started` once; `deadline = started + 80 s` goes into the run config; each model call gets `min(25 s, deadline − now − 8 s)`; one retry only if a second full call still fits; `maxDuration` is 90 s and the lock expires then.

## Testing Strategy

- **pytest** (all against `FakeLlm`):
  - `check_proposal`: every rule (unknown name, wrong capitalisation, empty, repeat in a different order, more than 8, redundant set), the reason text, and that rejections count towards the cap;
  - stopping rules: model says finished, two rounds with no improvement, round cap of six, rejections counted;
  - failure paths: unavailable, timeout, unusable reply, finished before any fit, failure after some rounds (best set kept), store unreachable;
  - SC-003: changing every test-year value changes no prompt, no attempt and no chosen set; a spy on the data access shows the test slice is read only in `final_test`, and exactly once per contender;
  - SC-002: across many scripted and randomised replies (including hostile ones) no fitted set contains a name outside the catalogue;
  - an unlisted model is refused with a spy client recording zero calls; each limit (hourly, daily, lock) refuses with zero calls; a refused start keeps no lock and no counter;
  - the key string never appears in any response, event, state, log record or exception text (the fake client is given a recognisable key and its text is searched for everywhere);
  - the new columns use nothing after over 10 (an innings with wild later overs gives identical values);
  - recipes, redundancy (known exact dependencies in the catalogue are found, independent sets pass, the reported features are right), forward selection (adds the best single feature, stops when nothing helps or at 8), three slices, the data check for older files, `--from-existing` refusing the new columns, and `/api/data`, `/api/models`, `/api/catalogue` contracts.
- **Vitest**: the TypeScript recipe interpreter equals the backend's results on a shared fixture; the form's inputs for a given winning feature set (base measurements only, competition choice, bounds); layout of a self-loop.
- **Playwright** (against the fake model through `playwright.config.ts` env): the model picker and default; the language-model node looks different from the code nodes; the leaderboard builds during the run; Play (and Reset) are disabled mid-run; a refusal message is shown and earlier results stay; the final three-way comparison and the winner appear; the model's reason is shown as plain text (a reason containing markup is not rendered as HTML); the "model did not take part" run with the broken fake model; no response seen by the page contains the key.
- **Regression**: everything that survives Decision 14 keeps passing; the Data tab tests are updated for the new columns and the three-valued "Used for".

## Risks

1. **Latency** (SC-004) is unmeasured. First task: time each starting model over a real run with the owner's key; drop slow ones from the list.
2. **Self-loop drawing** may not be readable. First front-end task checks it; fall back to a two-node loop.
3. **A fresh Cricsheet download** changes the data (new matches, new test year). Mitigation: review the data diff before building on it; the manifest records the new date and counts.
4. **Stateless rate limiting** depends on Upstash being configured. It fails closed (no model calls), never open.
5. **A model returning plausible but poor choices** is expected and shown honestly; it is the point of the comparison with forward selection.

## Complexity Tracking

No constitution gates. Departures from the brief's wording, each with its reason: `actor` instead of `kind` for node type (name clash); Reset disabled during a run (avoids orphaned server runs); an in-memory limit store for local and test use only (the brief required tests never to need Redis); the model list's fallback is used only when `MODEL_OPTIONS` is unset.
