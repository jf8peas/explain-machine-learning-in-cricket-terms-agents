# Quickstart: LLM-Driven Feature Selection

Run from `apps/linear_regression/` unless noted.

## One-off: rebuild the data with the new columns

The new columns need ball-by-ball detail, so this is a full run, not `--from-existing`:

```bash
uv run python scripts/prepare_data.py
git diff --stat data/
```

Review the diff: the download date and counts change, and the committed table gains the candidate columns. `--from-existing` on an old file fails with a clear message.

## Configuration (environment variables)

| Variable | Purpose | Local default |
|---|---|---|
| `OPENROUTER_API_KEY` | The owner's key; server only | none (the language-model step then fails safely) |
| `MODEL_OPTIONS` | JSON list of `{id, name, note, default}` | the checked-in fallback list (4 models) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared limit store | none |
| `RATE_LIMIT_STORE` | `memory` to use an in-process store (development and tests only) | unset |
| `VISITOR_ID_SECRET` | Server secret used to hash visitor addresses for the limits | random per process (weaker; set it in production) |
| `RUN_LIMIT_PER_HOUR`, `RUN_LIMIT_PER_DAY`, `LLM_MAX_TOKENS`, `LLM_MAX_CALLS`, `LLM_CALL_TIMEOUT`, `RUN_DEADLINE_SECONDS` | Limits | 5, 300, 800, 8, 25, 80 |
| `LLM_PROVIDER` | `fake` uses the scripted fake model (tests and e2e only; never set in production) | unset |

## Run locally with the fake model (no key, no network)

```bash
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run uvicorn api.index:app --port 8000
cd web && npm install && npm run dev
```

Open `http://localhost:5173/`, pick a model, press Play. The graph shows the language-model node in a different style; the leaderboard fills in; the results compare the three test-year errors.

## Run locally with a real model

```bash
export OPENROUTER_API_KEY=...      # in your shell only; never commit it
RATE_LIMIT_STORE=memory uv run uvicorn api.index:app --port 8000
```

Time a run per model (SC-004) and note which are slow enough to drop from `MODEL_OPTIONS`.

## Production (Vercel)

Set `OPENROUTER_API_KEY`, `MODEL_OPTIONS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `VISITOR_ID_SECRET` as environment variables (encrypted, server only). Do not set `LLM_PROVIDER` or `RATE_LIMIT_STORE`. `vercel.json` sets `maxDuration` to 90.

## Manual walkthrough

1. The intro says the agent uses a language model to decide what to try and that numbers come from code; a note says runs can differ.
2. The picker lists four models with a note each; one is selected. Changing it mid-run does nothing to the run.
3. Press Play: Play and Reset are disabled until the run ends.
4. Each proposal shows the chosen features and the model's reason, labelled as the model's reasoning; the next step shows the code's check (accepted or rejected with the reason).
5. The leaderboard lists every attempt, its features, its validation error and who proposed it.
6. Forward selection adds features one at a time and stops.
7. The results show three test-year errors (language model, forward selection, TV projection), who won and by how much, and which model ran.
8. Try your own innings asks only for the winning model's inputs.
9. Start five runs in an hour from one address: the sixth is refused with a message saying when to try again.
10. Unset `OPENROUTER_API_KEY` and run: the language-model step shows a failure, forward selection still completes, and the results say the language model did not take part.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test      # starts the API with the fake model and the in-memory store
cd web && npm run build
```
