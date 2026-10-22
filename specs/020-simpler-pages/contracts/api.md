# Contract: API and files

Additions only; every other route and field is unchanged. The page shows server wording as sent and inserts it as text.

## `GET /api/structure`

```jsonc
{
  "nodes": [{ "id": "propose_features", "kind": "node", "actor": "llm", "stage": "choose", "row": "round" }, ...],
  "rows": [
    { "id": "start",     "title": "Once, at the start", "note": "data preparation script ran beforehand" },
    { "id": "round",     "title": "Each round",         "note": "up to 6 rounds; rejected ideas count" },
    { "id": "yardstick", "title": "The yardstick",      "note": "runs when the agent stops" },
    { "id": "end",       "title": "Once, at the end",   "note": "the test season is unlocked here" }
  ]
  // edges, stages, loop, notes, items: as today
}
```

- Every node except `__start__` and `__end__` has a `row` that names an entry of `rows`. `check_rows` (pytest) fails otherwise.
- The component draws rows in the order given; it holds no row title, note, node or stage name of its own.
- The old band-and-edge drawing is gone, so a structure with no `rows` is not drawn as rows: the component shows a plain list of its nodes in the order given. `reuse.spec.ts` supplies `rows` in its fixtures for the other-app case.

## `GET /api/models`

```jsonc
{ "models": [ { "name": "...", "note": "...", "default": true, "choice": "m1" }, ... ],
  "run": { "per_hour": 5, "per_day": 300, "deadline_seconds": 80 } }
```

`run` is read from the settings the gate enforces. Model ids never appear.

## `step` event for `final_test` (inside `changes`)

`final.headlines`, `final.agent_verdict` and `final.agent_model` as in [data-model.md](../data-model.md). `final.verdict`, `final.accuracy`, `final.methods`, the top-level `features`, `coefficients`, `intercept`, `feature_iqr` and `explanation` are unchanged in meaning.

**Invariant (tested)**: for the same data and the same scripted model, every number in `final.accuracy`, `final.test_mae`, `final.validation_mae` and the top-level `coefficients` equals what the code produced before this feature.

## `web/public/recorded-run.json`

```jsonc
{ "recorded_on": "2026-10-23", "model_name": "…", "fingerprint": "sha256:…",
  "events": [ { "step": 1, "node": "load_data", "summary": "…", "changes": { … } }, … ],
  "done": { "steps": 12 } }
```

- `scripted: true` appears only in a recording made with `--fake`; the release check (`pytest -m release`) refuses to ship a file that has it.

- Served as a static file; `vercel.json` gets a cache header for it (`public, s-maxage=3600, stale-while-revalidate=86400`).
- Valid only if `fingerprint` equals the current data fingerprint and the last `final_test` event's `headlines` equal what `headlines.py` builds from that event's own inputs. `tests/test_recorded_run.py` checks both.
- Tests use `web/tests/fixtures/recorded-run.fake.json`, made by `scripts/record_run.py --fake`; a pytest regenerates it in memory and compares (date and model name excluded).

## Headline cases (shared fixture)

`web/tests/fixtures/headline_cases.json`: an array of `{name, inputs, expected}`; `inputs` has the agent's, the search's and the TV's displayed test misses, `rounds_used`, `llm_took_part` and the margin; `expected` has `case`, `hero_h1`, `verdict_h2`, `vs_search` and `scoreboard`. Cases cover: beat by at least the margin; beat by exactly the margin; beat by less; level with the TV; worse than the TV; no language model; the agent and search within 0.5 runs; the search clearly ahead of the agent; one try; the pick differing from the agent.
