# Quickstart: Consistent Terminology

Run from `apps/linear_regression/`.

## Check the wording

```bash
uv run pytest tests/test_terms.py tests/test_terms_sources.py tests/test_wording_no_banned.py tests/test_static_terms.py tests/test_recorded_run.py
uv run python scripts/reword_recorded_run.py --check      # exit 0 when web/public/recorded-run.json matches the backend wording
```

If the check fails after you change a term or a wording function:

```bash
uv run python scripts/reword_recorded_run.py              # rebuilds the code-worded strings; no model, no run
uv run python scripts/reword_recorded_run.py --file web/tests/fixtures/recorded-run.fake.json
```

## Check the pages

```bash
cd web
npm run test                                  # Vitest, including no-literal-terms
npx playwright test banned-terms brute-force  # the banned-term check and the definition
npx playwright test word-count                # the word counts (printed)
```

## Change a term

Edit one row of `TERMS` in `backend/linreg/methods.py`, run the reword script, run the three test groups above. No page file changes.

## Word counts (feature 020 limits: 500 simple, 1,200 everything open)

Before column measured at T002 (all suites green: 1125 pytest, 423 Vitest, word-count e2e). The margins are thin: main simple has 8 spare words, main everything 6, so wording must be cut as terms and the definition (47 words) are added.

| Page | Level | Before | After | Limit |
|---|---|---|---|---|
| Main | Simple | 492 | 495 | 500 |
| Main | Everything, Scorebook closed | 1194 | 1195 | 1,200 |
| How this app was built | Simple | 483 | 495 | 500 |
| How this app was built | Everything | 1106 | 1173 | 1,200 |

Wording cut to stay inside the limits: on "How this app was built" the hero lead lost "A small web page replays it step by step."; Part 2's heading lost "as it finishes"; Part 4's heading lost "without running the agent again"; the Scoreboard and Commentary cards lost "Always shown." and "Open with Show me everything."; Part 5's code card lost "planned with Spec Kit" and a list of articles; and "Words we use" is a closed details element inside Commentary.
