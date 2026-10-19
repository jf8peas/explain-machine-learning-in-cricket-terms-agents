# Quickstart: "The final test" tab

From `apps/linear_regression`:

```bash
# Backend: facts, blocks, reply checks, final state
python -m pytest tests/test_cricket_facts.py tests/test_cricket_blocks.py tests/test_writing_reply.py \
  tests/test_write_step.py tests/test_final_test.py tests/test_reference_in_run.py

# Whole backend suite
python -m pytest

# Front end (from web/)
npm run test          # Vitest: final-race, final-closeness, final-takeaways
npm run build         # type-check and bundle
npx playwright test final.spec.ts     # then the whole suite: npx playwright test
```

Look at the tab: start the app as for earlier features, run with the fake model, replay to the `final_test` step (bars and bias words appear, "not ready" before it), then one step on (verdict, takeaways and rule of thumb appear). Check light and dark, and a 360 px window for sideways scroll.

Expected: three numbered sections, four rows (three without the AI model), shares in each closeness bar totalling 100, the verdict tick, dash or cross matching the figures, and no comparison box, accuracy table or scatter plot.
