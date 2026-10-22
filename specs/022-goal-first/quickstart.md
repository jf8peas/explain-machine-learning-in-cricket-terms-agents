# Quickstart: Goal First

Run from `apps/linear_regression/`.

## See it

```bash
cd web && npm run dev            # the page; the API in another terminal:
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run python -m uvicorn api.index:app --port 8000
```

Open `http://127.0.0.1:5173/`: the question, the goal card and "▶ Start the experiment". Choose the AI, press Play, watch the graph; the verdict, Your turn and the run-dependent Scorebook cards unlock when the run finishes. Add `?interval=120` to make "Watch it again" fast; `?view=everything` opens every Commentary panel.

With the fake models: `fake/steady` (the default), `fake/quick`, `fake/slow` (to see the ring move), `fake/markup`, `fake/broken`, `fake/timeout`.

## Check it

```bash
uv run pytest                                          # backend, including the start events and the doing lines
cd web
npx tsc --noEmit && npx vitest run                     # run state, locks, goal card, graph states
npx playwright test idle player graph-run locks failure word-count banned-terms
```

## The fake-run fixture

Tests that need a specific case serve a stream built from `web/tests/fixtures/fake-run.json`. After a change to the agent's wording or the fake model:

```bash
uv run python tests/make_fake_run.py      # rebuilds the fixture in process; no model, no network
```

`tests/test_fake_run_fixture.py` fails when it is stale.

## Word counts (390 px; limits 500 simple, 1,200 everything open)

Filled in at implementation step 8. Both states are measured: before a run, and after a fake-model run.

| Page | State | Level | 021 | Now | Limit |
|---|---|---|---|---|---|
| Main | before a run | Simple | 495 | 364 | 500 |
| Main | after a run | Simple | 495 | 497 | 500 |
| Main | before a run | Everything | 1,195 | 682 | 1,200 |
| Main | after a run | Everything | 1,195 | 1,194 | 1,200 |
| How this app was built | — | Simple / Everything | 495 / 1,173 | 410 / 1,084 | 500 / 1,200 |

The graph's diagram labels (node names, badges, row notes) are not counted, like the agent's reasoning. With them the main page after a run is 720 words (simple) and 1,374 (everything open).

Wording cut to stay inside the limits (after a run): the loop strip shows only with Show me everything, and the Scorebook cards' one-line descriptions are read out but shown only when a card is locked; the scale note under the player is gone; a repeated idea's reason reads "That idea was already tried."; a round's row no longer shows its seasons (they are in Commentary with the other settings); the rule of thumb is a Commentary card of the verdict; the example innings' venue line is read out but not shown; "Who does what" is one sentence; the runs-each-clue-adds label lost its source (the rule card names it).
