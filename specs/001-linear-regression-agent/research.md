# Research: Linear Regression Agent App

All technical decisions were supplied with the plan request, so no `NEEDS CLARIFICATION` items remain. This records the decision, rationale and alternatives for each, plus the points that needed checking.

## Agent framework

- **Decision**: LangGraph `StateGraph` with a `TypedDict` state, deterministic nodes, no LLM.
- **Rationale**: Gives a real graph with conditional edges, a streaming API (`stream_mode="updates"` yields one `{node: update}` per completed node) and a structure export (`get_graph()`), which are exactly what the visualiser needs. It is also the pattern the other seven apps will reuse.
- **Alternatives**: A hand-rolled state machine (less to install, but the visualiser contract would be ours alone and the "agent" framing weaker); LLM-driven routing (rejected: non-deterministic, slower, breaks FR-017).

## Streaming transport

- **Decision**: Server-Sent Events over `fetch()` with a stream reader, not `EventSource`.
- **Rationale**: `EventSource` auto-reconnects on drop, which would silently rerun the agent and break "stepping back does not rerun" and the disconnect behaviour. `fetch` also allows `AbortController` for Play-again.
- **Alternatives**: WebSockets (heavier, poor fit for serverless functions); one JSON response with all events (loses "live stream of one event per completed node" required by FR-029).

## Structure export

- **Decision**: Reduce `get_graph().to_json()` to `{nodes: [{id}], edges: [{source, target, conditional, branch}]}`; fall back to target node name when the label is missing.
- **Rationale**: Insulates the visualiser from LangGraph's internal JSON shape, which can change between versions. The `__start__`/`__end__` pseudo-nodes are kept as nodes of type `start`/`end` so the viewer can draw entry and exit.
- **Check needed**: label fidelity for dict-mapped conditional edges, covered by a pytest (see plan risks).

## Layout and rendering

- **Decision**: SVG rendered by a custom element, layout by `@dagrejs/dagre`.
- **Rationale**: Framework-free, so it embeds in the website regardless of its stack; dagre handles layered DAGs with loops well enough for 8 to 10 nodes and is small.
- **Alternatives**: React Flow (framework-bound); Mermaid (no per-edge marker animation or per-node state); hand-placed coordinates (violates FR-030, since each app would need its own).

## Model and metric

- **Decision**: ordinary least squares with an intercept, solved with numpy (originally scikit-learn `LinearRegression`; replaced on 2026-10-01 because scikit-learn and scipy pushed the Vercel function to 564 MB, over the 500 MB limit; a test checks the coefficients match scikit-learn's); error = mean absolute error in runs; also R². Baseline `(runs_at_10 / 10) × 20`.
- **Rationale**: MAE is in runs, which a cricket fan can read directly. Ordinary least squares gives coefficients that translate into sentences ("each wicket costs N runs").
- **Alternatives**: RMSE (penalises outliers, harder to say in cricket terms); statsmodels (richer stats, unneeded dependency weight in the function).

## Feature importance for the explanation

- **Decision**: Rank features by `|coefficient| × IQR(feature in training data)`.
- **Rationale**: Raw coefficients are not comparable across features of different scale (wickets 0–9 vs runs 0–200). The IQR gives a "typical difference" so each can be written as "a typical difference in X moves the final total by N runs".
- **Note**: Features are correlated (runs and powerplay runs), so importance is conditional on the features present at the final fit; the explanation says "given the other things the model knows".

## Split

- **Decision**: Calendar year of `match_date`; latest year = test; earlier years = train; competitions pooled; fail below 100 test innings.
- **Rationale**: Matches the clarified spec; avoids same-match/same-season leakage.
- **Note**: `match_date` is a required column even though FR-002 lists only `season`.

## Data preparation

- **Decision**: Offline script downloads Cricsheet JSON zips for men's T20Is, IPL and BBL, writes `innings.csv` and `manifest.json`; the function only reads the CSV.
- **Rationale**: Keeps requests fast and dependency-light, makes the data reproducible and reviewable in git, and allows attribution and exclusion counts to be recorded once.
- **Details**: Cricsheet overs are zero-indexed, so "after 10 overs" = cumulative totals through over index 9; powerplay = indexes 0–5. Exclusions: no result, D/L method, reduced overs, super overs, all out before 10 overs, with counts logged in the manifest. Only first innings are kept.
- **Licence**: Cricsheet data is published under the Open Data Commons Attribution License; attribution is shown on every data/results view and recorded in the manifest. To confirm at implementation time against the current Cricsheet site.

## Hosting

- **Decision**: One Vercel project, Root Directory `apps/linear_regression`, static Vite build plus Python function, `maxDuration` set well above the run time, ignored build step limited to the app directory.
- **Rationale**: Each app is its own endpoint and deployable; the website can iframe or proxy it.
- **Bundle size**: pandas, numpy, scipy, scikit-learn and LangGraph together are well under the 500 MB limit; data-prep and test dependencies are kept out via a dev dependency group and an exported `requirements.txt`.
- **Alternatives**: Separate static and API projects (more config, CORS); non-Vercel hosting (not requested).

## Testing

- **Decision**: pytest for backend, Vitest for pure visualiser logic (buffer, pacing), Playwright for keyboard, reduced motion, replay and disconnect behaviour, plus a second unrelated graph fixture for reuse (SC-007). SC-004 is a manual reader test.
- **Rationale**: Each layer is tested where its behaviour is observable; SC-004 is human judgement and is not meaningfully automatable.
