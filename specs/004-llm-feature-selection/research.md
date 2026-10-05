# Research: LLM-Driven Feature Selection

Date: 2026-10-04. Model facts come from OpenRouter's public model and endpoint lists (read on this date, no key needed); platform limits come from Vercel's and Upstash's current docs. Anything I could not measure is marked as such.

## Decision 1: The four starting models

**Decision**: Offer these four, with the first as the default. All are served only by the model maker's own host or the big cloud hosts, all accept `max_tokens` and JSON output, and all show 99%+ uptime over the last day.

| Friendly name | OpenRouter id | One-line note | Hosts (all first-party or major cloud) | Price per million tokens (in / out) | About per run* |
|---|---|---|---|---|---|
| Fast (default) | `openai/gpt-6-luna` | Quick and cheap; a good first try | OpenAI, Azure, Amazon Bedrock (7 endpoints) | $0.10 / $0.50 | $0.003 |
| Fast, different maker | `google/gemini-3.8-flash` | A quick model from a different maker, to compare styles | Google, Google AI Studio (6 endpoints) | $0.75 / $3.75 | $0.025 |
| Balanced | `anthropic/claude-haiku-4.5` | A little slower, usually careful with its reasons | Anthropic, Azure, Bedrock, Google (8 endpoints) | $1.00 / $5.00 | $0.033 |
| More thorough | `anthropic/claude-sonnet-5.5` | The slowest and most careful; costs the most | Anthropic, Azure, Bedrock, Google (8 endpoints) | $2.00 / $10.00 | $0.066 |

*Six calls of about 3,000 tokens in and 500 out. At the default limits (300 runs per day) the worst case is about $1 a day on the default model and about $20 a day if every run used the most expensive one.

**Rejected**:
- `deepseek/deepseek-v4.1-flash` (31 hosts) and `xiaomi/mimo-v2.6-flash` (8 hosts, several under 90% uptime): many third-party hosts, so latency is unpredictable, as the brief warned.
- `qwen/qwen3.8-omni-flash` and `inception/mercury-2.5`: one host each, with 98 to 99% uptime in the last half hour. No fallback if it fails.
- `x-ai/grok-4.7`: five endpoints on one host, with a day's uptime as low as 95.7% on one of them.
- `openai/gpt-6-sol` and `openai/gpt-6.1-sol`: same price as Sonnet with no clear advantage for this task.

**Not measured**: OpenRouter's list gives no latency or throughput numbers (they came back empty), so I could not check SC-004 (about a minute). A first task in `tasks.md` times a real six-round run per model with the owner's key; if a model is too slow it is dropped from the list before release. The list is configuration, so changing it needs no code change.

**Notes on the endpoints**: a few Anthropic hosts (Bedrock) advertise `response_format` but not strict structured outputs. Because replies are always parsed defensively and validated, that is fine, and the client does not set OpenRouter's `require_parameters` (it would hide hosts that lack an optional parameter such as `reasoning`).

## Decision 2: The model call

**Decision**: One class, `OpenRouterClient`, with a single method `complete(payload) -> str`, in `backend/linreg/llm_client.py`. It uses `httpx` to POST `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <OPENROUTER_API_KEY>`, the chosen model id, `messages`, `max_tokens` (default 800, owner-adjustable), a low `temperature` (0.3), and `response_format` set to a JSON schema for `{features, reason, finished}`. If the host rejects `response_format` (a 4xx saying it is unsupported), that is the one allowed retry: the same call without it, with the prompt still asking for JSON.

**Parsing** (`llm_reply.py`): plain JSON, then strip a markdown code fence, then the text from the first `{` to the last `}`. The result is validated by a pydantic model (`features: list[str]`, `reason: str`, `finished: bool = False`, extra keys ignored). Anything else raises `UnusableReply`.

**The key**: read from `OPENROUTER_API_KEY` only inside the client. Before any message is logged or raised, the key string is replaced by `[redacted]`. Logs hold the model id, the elapsed time and the failure kind only.

**Interface for tests**: `LlmClient` is a `Protocol` with `complete`. `FakeLlm` (in `llm_fake.py`, scripted by model id) is chosen with `LLM_PROVIDER=fake`. Production never sets it. A test checks that, without that variable, the real client is built and, with the key missing, calling it fails safely as "unavailable" without a network call.

## Decision 3: The time budget and `maxDuration`

**Facts** (Vercel docs, updated 2026-08-24): with Fluid compute (on by default) the default `maxDuration` is 300 s and the maximum is 300 s on Hobby, 800 s on Pro. For a Python function the setting goes on the entrypoint in `vercel.json` (`api/index.py`, as now).

**Decision**: `maxDuration` = **90** (one minute for SC-004 plus 30 seconds of headroom). `/api/run` records `started = time.monotonic()` once at the top and puts `deadline = started + 80` in the run's config (10 s of headroom inside the 90). Per call: `timeout = min(25, deadline - now - reserve)`, where `reserve` is 8 s (forward selection, the final test and the explanation take milliseconds, so this is generous). A retry happens only if the remaining time covers a second full call plus the reserve. If the time is nearly gone, the loop stops and the run continues to forward selection with whatever the model has produced so far.

The in-progress lock expires after `maxDuration` (90 s), so a crashed run cannot lock a visitor out.

## Decision 4: Rate limits with Upstash Redis over REST

**Facts**: the REST API takes a JSON command array in a POST body to the database URL, with `Authorization: Bearer <token>`; `/pipeline` runs several commands in one request; results come back as `{"result": ...}`. Conventional variable names are `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Decision**: three keys per check, all through one `/pipeline` call so a start costs one round trip:
- hourly counter `runs:hour:<visitor>:<hour bucket>`: `INCR`, then `EXPIRE ... 3600 NX` on the first hit;
- daily counter `runs:day:<UTC date>`: `INCR`, then `EXPIRE ... 86400 NX`;
- lock `run:lock:<visitor>`: `SET ... NX EX 90`.

The order is: take the lock first (refuse if held), then count. A refusal releases what it took, so a refused start does not use up quota or leave a lock. The lock is released (`DEL`) when the run ends, in a `finally`, including when the browser disconnects.

**Visitor id**: the first address in the `X-Forwarded-For` header Vercel sets, hashed with a server secret (the address is never stored or logged in the clear).

**Messages**: "You can start another run in 12 minutes", "Today's limit of runs has been reached; try again after 00:00 UTC", "A run is already in progress for you." with the HTTP code (429) and a `Retry-After` header.

**Fail closed**: if the store is unreachable or not configured, the run is still allowed, but with no language-model call (forward selection only), and the results say so (FR-033). An in-memory store exists for local development and tests only and is chosen with `RATE_LIMIT_STORE=memory`; without it and without Upstash settings the app behaves as "store unreachable".

## Decision 5: Where each limit lives and how the run is admitted

`graph_api.create_router` stays generic. It gains an optional `admit(request) -> Permit` hook (raises `Refusal(status, message, retry_after)`) and a `run_config(permit, request)` hook, plus `node_meta` for the structure. The app supplies them from `run_gate.py`. The permit carries the chosen model id, whether the language model may be used, and a `release()` that `run_events` calls in `finally`.

Refusal order, all before any model call: unknown or unlisted model (400), concurrent run (429), hourly limit (429), daily cap (429). A request that names a model not in the list never reaches the client.

## Decision 6: One catalogue, one recipe

`features.py` becomes the catalogue. Each entry has `id`, `label`, `description`, `unit`, an optional `bounds`, and a `source`: either `{"measured": true}` (a column the script computes from the ball-by-ball data) or a recipe, which is data, not code:

- `{"difference": {"from": 10, "of": "wickets_at_10"}}` (wickets in hand);
- `{"product": ["runs_at_10", "wickets_in_hand"]}`;
- `{"indicator": {"column": "competition", "equals": "ipl"}}` (the dummies, taken from `competition_dummies.py` so that file stays the one definition of the mapping).

One small interpreter in Python (`recipes.py`) is used by the script (to write the derived columns), the backend (to check them on load) and the tests. The browser gets the catalogue from `GET /api/catalogue` and uses a 30-line interpreter in TypeScript (`recipes.ts`). A Vitest test feeds both interpreters the same fixture of inputs and expected outputs written by the backend, so the two cannot drift. So the formula is written once, as data.

## Decision 7: The candidate features (16)

All measured at the end of over 10 (over indexes 0 to 9). Definitions follow Cricsheet's data:

| id | What it is |
|---|---|
| `runs_at_10`, `wickets_at_10`, `powerplay_runs` | as before |
| `powerplay_wickets` | wickets lost in overs 1 to 6 |
| `runs_overs_7_10`, `wickets_overs_7_10` | runs scored and wickets lost in overs 7 to 10 |
| `fours_at_10`, `sixes_at_10` | boundaries hit (batter runs 4 or 6, not "non-boundary") |
| `dot_balls_at_10` | deliveries from which no run came |
| `extras_at_10` | extras conceded (wides, no-balls, byes, leg-byes) |
| `partnership_runs` | runs scored since the last wicket fell (the current partnership) |
| `balls_since_last_wicket` | legal balls since the last wicket fell |
| `wickets_in_hand` (derived) | 10 minus wickets lost |
| `runs_x_wickets_in_hand` (derived) | runs at 10 overs times wickets in hand |
| `is_ipl`, `is_bbl` (derived) | the competition dummies from feature 003 |

Nothing after the end of over 10 is used; a test builds an innings whose later overs differ wildly and checks every candidate is unchanged. Exact repetitions in this list (wickets in hand with wickets lost; runs at 10 = powerplay runs + runs in overs 7 to 10; wickets at 10 = powerplay wickets + wickets in overs 7 to 10; fours, sixes and so on with their parts) are caught by the numeric check below, not by a list.

## Decision 8: The redundancy check

**Decision**: for a set of k features, build the training design matrix `[1, X]`. If its numerical rank is below k + 1 (rank from SVD with a relative tolerance of 1e-9 times the largest singular value) the set is redundant. To report which features repeat: drop each feature in turn and keep those whose removal does not lower the rank; those are the features involved in a dependency, reported in plain language ("runs at 10 overs repeats powerplay runs and runs in overs 7 to 10"). The same function guards forward selection (a candidate is skipped if adding it makes the set redundant), the proposal check, and the final fits. A constant column is flagged too (it duplicates the intercept).

## Decision 9: The new data download

The ball-by-ball detail is not in the committed `innings.csv`, so the new columns need a full re-run of `scripts/prepare_data.py` against fresh Cricsheet downloads (the existing, feature-003 download path). Consequences: the download date and counts in the manifest change, the set of kept innings may change if Cricsheet has added matches, and the latest "test year" may now hold a different number of innings. `--from-existing` keeps working for the dummies, but fails with a clear message if asked to add the new columns (it cannot: it has no ball-by-ball data). The script's manifest gains a `features` entry (columns and their source), and its rows are checked against the catalogue.

**Result of the rebuild (T017, 2026-10-04)**: Cricsheet returned the same matches as the 2026-10-01 download (3,558 / 1,243 / 662 read; 3,317 / 1,210 / 619 kept; 5,146 innings), so the nine original columns are identical to before. The download date is now 2026-10-04. Slices: training 2005 to 2024, validation 2025 (595 innings), test 2026 (515 innings). The measured parts add up exactly (powerplay runs plus runs in overs 7 to 10 equals runs at 10; the wickets likewise), and there are no blank values.

## Decision 10: Three slices

`season_split.split_by_year` returns a small `Slices` value: training (years before the validation year), validation (the second most recent year), test (the most recent year), with the two years. The Data tab's "Used for" uses the same function and gets Training, Validation or Test. The minimum-innings check (`MIN_TEST_INNINGS`, 100) applies to validation and to test. The existing `baseline` step now scores the TV projection on the **validation** year (it must not read the test year); `final_test` scores it on the test year once.

## Decision 11: Graph and visualiser changes (generic ones)

- **Self-loop**: dagre supports self-edges. **Checked (T003): `layoutGraph` already returns a routed loop beside the node (7 points, a label position, inside the drawing), pinned by a test in `layout.test.ts`, so `forward_selection` is a self-loop.** The drawing itself is checked in the Playwright run test (T056).
- **Node metadata**: the structure's nodes already use `kind` for `start`/`end`/`node`, so I add a separate field, **`actor`** (`"llm"` or `"code"`), instead of reusing `kind` as the brief wrote. `<graph-replay>` gives `actor: "llm"` nodes a different fill and a small "LLM" tag, and knows nothing else.
- **Play disabled while running**, and **Reset disabled too** until the run ends. Reset today aborts the stream; with Play disabled that would leave a server run going while the visitor could start another, so Reset waits for the end (Back, Step and the timeline still work throughout).
- **Refusal**: `streamRun` currently treats any non-OK response as a lost connection. It now reads the JSON body (`message`, `retry_after_seconds`) of a refusal, calls a new `onRefused(message)`, and starts the run's buffer only after a 2xx. So a refused start shows the message and keeps whatever was on screen.
- **Model choice reaches the run** through the `run-url` the page sets (`/api/run?model=<id>`); the URL is read when Play is pressed, so a later change does not touch a run in progress.

## Decision 12: What counts as the winner

The winner is whichever of the language model's best set and forward selection's set has the lower **test-year** mean absolute error. A tie goes to forward selection (the simpler, mechanical method). The beat-the-TV rule stays as in feature 001: the winner must be at least 3 runs better than the broadcaster's projection to count as beating it. If the language model took no part, the winner is forward selection by default and the results say that. The "winning model" for the explanation and the try-your-own form is the winner's fitted model, fitted on the training years.

## Decision 13: What the language model sees

Per call: a system message (the task, the rules, the exact JSON shape, the set-size limit of 8, rounds remaining), then a user message with: the catalogue (id, label, description, unit); training-years-only explore statistics (the correlation of each candidate with the final total, and the means by wickets lost and by competition); the attempt history (features, validation error, improved or not); the rejections with reasons. It never gets validation rows or any test-year number. (The validation error of earlier attempts is given to it, as the feature requires; the test year never.) Its reason is stored and shown verbatim.

## Decision 14: Existing tests that are replaced

The fixed-order loop goes, along with its tests, so these are rewritten or removed: `test_run_unchanged.py` and `fixtures/golden_run.json` (the golden-run guarantee is superseded by this feature), `test_routing.py`, `test_termination.py`, `test_nodes.py`, `test_explanation_numbers.py`, `test_split.py`, `test_baseline.py` and the real-data and load-data-stop tests that assume the old split and node order; and Playwright's `tune.spec.ts`, `play.spec.ts` (the "Play again" test), `explanation.spec.ts`, `panels.spec.ts`, `navigate.spec.ts`, `structure.spec.ts` and `tryit.spec.ts` where they assume the old graph. `conftest.make_table` gains the new columns.

## Open questions

None blocking. Three things are deliberately left to measurement, not guesses: model latency (Decision 1), whether the self-loop is readable (Decision 11), and the exact reply token cap (800 to start).
