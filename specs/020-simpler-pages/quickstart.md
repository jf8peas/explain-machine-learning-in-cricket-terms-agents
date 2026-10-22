# Quickstart: Simpler Pages

Run from `apps/linear_regression/` unless stated.

## Check the backend

```bash
uv run pytest                          # includes the headline cases, NODE_ROWS, agent model and recorded-run checks
```

## Check the front end

```bash
cd web
npm install
npm test                               # Vitest: headline cases, detail level, run source, rows, player labels
npm run build                          # tsc --noEmit, then both pages
npm run e2e                            # Playwright against the fake language model (stop any API on port 8000 first)
```

## Record the run (owner, once the backend phase is merged)

```bash
OPENROUTER_API_KEY=... uv run python scripts/record_run.py            # writes web/public/recorded-run.json
uv run python scripts/record_run.py --fake --out web/tests/fixtures/recorded-run.fake.json   # the test fixture
```

Re-record whenever the data is rebuilt or the headline wording changes; `pytest tests/test_recorded_run.py` fails until you do.

## See it

```bash
LLM_PROVIDER=fake uv run python -m uvicorn api.index:app --port 8000    # in one terminal
cd web && npm run dev                                                   # in another; open http://127.0.0.1:5173
```

- **Simple view**: the hero shows the headline and both averages with no scrolling at 390 × 664; "Watch it think" plays by itself when scrolled to.
- **Everything**: press "Show me everything", or open `/?view=everything`; the Scorebook stays closed.
- **Old links**: `/#working`, `/#found`, `/#final-test`, `/#try-your-own`, `/#data`.
- **Built page**: `/under-the-hood.html`.

## Acceptance walk-through

1. 390 × 664: h1 and both averages visible without scrolling; header on one row.
2. Scroll to "Watch it think": rounds appear by themselves; "❚❚ Pause" pauses; reduced motion shows the finished run.
3. Block `/api/run` in DevTools: the whole page and every Scorebook panel still render.
4. Open "Run it live with your choice of AI": the select, note, limits and "Start live run"; hero keeps its figures until the live final test arrives, then switches.
5. "Show me everything", reload, then go to the built page: still on. `?view=everything` turns it on.
6. Word counts: the size test passes (≤ 500 simple, ≤ 1,200 everything, each page).
