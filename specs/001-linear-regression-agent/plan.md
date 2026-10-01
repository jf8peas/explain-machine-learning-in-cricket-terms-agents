# Implementation Plan: Linear Regression Agent App

**Branch**: `001-linear-regression-agent` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification plus the technical decisions supplied with `/speckit-plan`.

## Summary

A deterministic LangGraph agent (no LLM) predicts a T20 first innings' final total from the state at 10 overs, benchmarked against the broadcaster's projection (run rate × 20). A FastAPI service on Vercel exposes the graph's structure (`GET /api/structure`) and a Server-Sent Events stream of one event per completed node (`GET /api/run`). A framework-free `<graph-replay>` web component draws the graph and replays the stream with Play/Pause/Step/Back/Reset, timeline and keyboard control. The visualiser knows nothing about cricket, so the other seven apps can reuse it unchanged. Data is prepared offline from Cricsheet into a committed `innings.csv`.

## Technical Context

**Language/Version**: Python 3.12 (backend, data prep); TypeScript (visualiser and page)
**Primary Dependencies**: LangGraph, FastAPI, pandas, numpy (least squares solved with numpy; scikit-learn is test-only); Vite, `@dagrejs/dagre` (web). Dev only: pytest, Vitest, Playwright, `requests` for data prep
**Storage**: Committed files only: `data/innings.csv`, `data/manifest.json`. No database, no server state
**Testing**: pytest, Vitest, Playwright (see Testing Strategy)
**Target Platform**: Vercel (static assets plus Python function) for the app; modern evergreen browsers for the page
**Project Type**: Web app (Python API plus static front end) inside a uv-workspace monorepo
**Performance Goals**: Agent run completes and all events are received within a few seconds (SC-002). The model fits on a few thousand rows, so compute is milliseconds; first-byte time is dominated by cold start
**Constraints**: Function bundle well under Vercel's 500 MB Python limit; SSE must not be buffered or cached; no `EventSource`; no network access at request time
**Scale/Scope**: About 8 nodes, about 5,000 to 10,000 innings, public read-only traffic, one app (of eight eventually)

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the spec instead: no hard-coded numbers in explanations (FR-017), no random splits (FR-009), shared pieces stay in-app (FR-031).

## Project Structure

### Documentation (this feature)

```text
specs/001-linear-regression-agent/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── structure.schema.json
    ├── step-event.schema.json
    └── api.md
```

### Source Code (repository root)

```text
pyproject.toml                      # uv workspace root; members = ["apps/*"]
uv.lock
CLAUDE.md
apps/linear_regression/
├── pyproject.toml                  # runtime deps; dev group holds data-prep/test deps
├── requirements.txt                # exported from uv for the Vercel function (runtime deps only)
├── vercel.json                     # maxDuration, headers, ignoreCommand, rewrites
├── api/
│   └── index.py                    # Vercel entry: exposes the FastAPI app
├── backend/linreg/
│   ├── # --- app-specific ---
│   ├── state.py                    # RunState TypedDict, MARGIN_RUNS, FEATURE_ORDER
│   ├── features.py                 # feature definitions and ordering
│   ├── regression.py               # fit / predict (LinearRegression)
│   ├── nodes.py                    # the 8 node functions
│   ├── graph.py                    # builds the StateGraph and routing functions
│   ├── # --- shared-library candidates (each self-contained) ---
│   ├── data_loading.py             # read and validate innings.csv, DataError
│   ├── season_split.py             # calendar-year split
│   ├── evaluation.py               # MAE, R², baseline comparison
│   ├── cricket_explanation.py      # templates filled only from state
│   └── graph_api.py                # structure reducer + SSE stream, FastAPI router
├── scripts/
│   └── prepare_data.py             # offline Cricsheet roll-up (dev only)
├── data/
│   ├── innings.csv
│   └── manifest.json
├── web/
│   ├── package.json, vite.config.ts, tsconfig.json
│   ├── index.html                  # the app page
│   ├── src/
│   │   ├── page/                   # app-specific: results area, try-your-own, attribution
│   │   └── graph-replay/           # shared-library candidate: generic visualiser
│   │       ├── graph-replay.ts     # the custom element
│   │       ├── buffer.ts           # event buffer + paced playback (pure, unit-testable)
│   │       ├── sse.ts              # fetch() stream reader
│   │       ├── layout.ts           # dagre wrapper
│   │       └── styles.ts
│   └── tests/
│       ├── unit/                   # Vitest
│       ├── e2e/                    # Playwright
│       └── fixtures/               # unrelated second graph + events (SC-007)
└── tests/                          # pytest
    ├── fixtures/                   # tiny hand-made Cricsheet JSON files
    ├── test_prepare_data.py
    ├── test_split.py
    ├── test_baseline.py
    ├── test_routing.py
    ├── test_termination.py
    ├── test_load_data_stop.py
    ├── test_explanation_numbers.py
    └── test_api.py
```

**Structure Decision**: Everything lives in `apps/linear_regression/`. Each shared-library candidate (FR-031) is a module with no imports from app-specific modules. Dependencies point one way: `nodes.py` imports the shared modules, never the reverse. `cricket_explanation.py` takes plain values and a feature-label mapping, so "cricket" vocabulary comes from the app's `features.py`, not from the module. `graph_api.py` takes any compiled LangGraph app. `graph-replay` takes only two URLs. `prepare_data.py` is app-local (not repo-root) because the brief says the app lives entirely in `apps/linear_regression/`.

## Key Design Decisions

1. **Graph shape.** Nodes `load_data → explore → split → baseline → fit_model → evaluate`. Conditional edges: `load_data` → {`ok`: explore, `stop`: END}; `evaluate` → {`tune`: tune, `explain`: explain_in_cricket_terms}. `tune → fit_model`. `explain_in_cricket_terms → END`. All routing functions are pure reads of state; the decision and reason are written by `evaluate` and `load_data`, because routing functions cannot emit updates.
2. **Loop bound.** `evaluate` can choose `tune` only while `len(features) < len(FEATURE_ORDER)`, so at most three fits occur; `recursion_limit` (e.g. 40) is a backstop, not the mechanism.
3. **Margin.** `MARGIN_RUNS = 3` in `state.py`. Condition for `tune`: `baseline_mae - model_mae < MARGIN_RUNS` and untried features remain.
4. **Step event.** `{step, node, summary, changes}`. `step` is a 1-based counter added by the stream layer; `summary` is taken from the node's returned `summary`; `changes` is the rest of the node's update. Because `summary` is also a state key, it is stripped from `changes` and from the accumulated state the visualiser builds.
5. **`attempts` reducer.** `Annotated[list[Attempt], operator.add]`; `fit_model` returns the model, `evaluate` returns the single attempt, so each loop iteration appends exactly one.
6. **Accumulated state in the browser.** The visualiser builds state by shallow-merging each event's `changes`. For append-reduced keys (`attempts`), the stream layer sends the *full accumulated list* in `changes`, so the client needs no knowledge of reducers (see contracts/api.md).
7. **Branch inference for the marker.** The client animates along the edge (`from` → `to`) between consecutive events. When more than one edge exists between two nodes it picks the one whose branch matches the structure; ties are impossible in this graph. A `stop` after `load_data` has no following node, so the marker ends on `__end__` when `done` arrives.
8. **Try-your-own.** Pure client function from the final state's `coefficients`, `intercept`, `features`; no endpoint.
9. **Paths.** The Vercel function serves under `/api` (`/api/structure`, `/api/run`); the visualiser is always given full URLs and never assumes a path.
10. **Hosting.** One Vercel project, Root Directory `apps/linear_regression`. Vercel's Python builder reads `requirements.txt` from that directory, so it is exported from uv and committed; CI check keeps it in sync with the lockfile.

## Testing Strategy

| Area | Tool | What is proven |
|---|---|---|
| Roll-up | pytest | zero-indexed overs (index 9 and 0–5), each exclusion rule, manifest counts |
| Split | pytest | no year overlap; test set is the latest year |
| Baseline | pytest | `(runs_at_10 / 10) × 20` |
| Routing | pytest | three `evaluate` branch cases; `load_data` ok/stop |
| Termination | pytest | loop ends for any data, including worst-case margin |
| Stop path | pytest | missing file, empty file, < 100 test innings → no later node runs |
| Explanation | pytest | every number in the text is found in final state (SC-003) |
| API | pytest | SSE event shape, node order, `done`/`error` events, no-cache header |
| Buffer/pacing | Vitest | buffering, paced advance, back/jump replay from buffer |
| UI behaviour | Playwright | keyboard, reduced motion (`emulateMedia`), Play-again-mid-run, mid-stream disconnect |
| Reuse | Playwright | second unrelated graph and stream render with no code changes (SC-007) |
| Reader test | manual | SC-004, listed in the quickstart |

## Risks and Open Points

- **3-run margin vs. real data.** Whether runs at 10 overs alone clears the margin, and whether the tune loop therefore appears (US5), depends on the data. `quickstart.md` includes a step to run the pipeline on real data and check; the margin is a single constant, so adjusting it does not change any other behaviour.
- **Margin result on real data (recorded 2026-10-01).** With the committed `innings.csv` (5,146 innings; test year 2026, 515 innings), the TV projection misses by 20.9 runs. The model misses by 19.7 (runs only), 19.3 (plus wickets) and 19.2 (plus powerplay), so it beats the projection by at most 1.7 runs and never reaches the 3-run margin. The tune loop therefore always runs all three fits, and the explanation says so honestly. `MARGIN_RUNS` stays at 3 as specified; lowering it to 1 would let the run stop after the first fit, which would hide the tune loop (US5).
- **SC-001 depends on the data.** Linear models on these features usually beat the doubled-runs projection (which ignores wickets and acceleration), but this is verified by a pytest check against the real committed `innings.csv`, not assumed.
- **Vercel Root Directory vs. workspace root.** With the root set to the app directory, files outside it are only available if "include source files outside of the Root Directory" is enabled (the default). The plan avoids relying on this by committing `requirements.txt` and keeping everything the function reads under the app directory.
- **SSE on Python functions.** Streaming responses are supported, but intermediaries must not buffer; `Cache-Control: no-cache` and `X-Accel-Buffering: no` are set. Verified in the deployed preview as part of the quickstart.
- **LangGraph edge label.** `get_graph().to_json()` may omit conditional edge labels; the reducer falls back to the target node name (e.g. `tune`, `explain`). For `load_data`'s `stop` branch the target is `__end__`, so the fallback label would be `__end__`; the reducer maps this to the declared branch name when a `path_map` is available and falls back otherwise. A pytest asserts the labels `ok`, `stop`, `tune`, `explain` appear.
- **Cricsheet format drift.** The roll-up relies on the current JSON layout (`innings[].overs[].deliveries[]`, `outcome`, `overs` field, `supersover`/`method`). Fixtures pin this; the manifest records the download date.
