# Quickstart: verify the panel copy

1. Backend: run the pytest suite for `apps/linear_regression` (stage, structure and the new numbers test).
2. Regenerate `web/tests/fixtures/linreg-structure.json` from `GET /api/structure` (server with `LLM_PROVIDER=fake`); the drift test must pass.
3. Web: run the unit tests and `npx playwright test tests/e2e/stages.spec.ts`.
4. Open the graph page: stage 5 reads "Choose the candidate model"; each card shows its question and a note; the paragraph under "All" is the one-sentence years line.
5. Change a constant locally (for example `ROUND_CAP`): the note text follows and the numbers test still passes.
