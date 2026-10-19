# Quickstart: Validation versus Test

From `apps/linear_regression`:

```bash
# Backend: takeaway 1 variants, the prompt's reason instruction, no "winner" in the explanation text
../../.venv/Scripts/python -m pytest tests/test_cricket_blocks.py tests/test_cricket_facts.py tests/test_prompts.py tests/test_explanation_numbers.py

# Whole backend suite
../../.venv/Scripts/python -m pytest

# Front end (from web/)
npm run test                 # Vitest: exam, found-choice, final-copy, and the updated view tests
npm run build                # type-check and bundle
npx playwright test final.spec.ts found.spec.ts      # then the whole suite: npx playwright test
```

## See the design's run say "too close to call" on both tabs

The design's run is validation: rival 17.0, AI 17.4; test: AI 17.7, rival 17.8.

- **In the unit tests**: `web/tests/unit/final-fixtures.ts` gets a `designRun` state with exactly these four figures. `exam.test.ts` and `found-choice.test.ts` assert that `choiceView` is `whisker` (gap 0.4) and that `compareSentence` and `leadSentence` say "too close to call" for it.
- **In the browser**: `final.spec.ts` and `found.spec.ts` serve a crafted one-step run with these figures (the same approach `craft()` uses in `final.spec.ts`), then check `[data-testid=choice-panel][data-state=whisker]` on What the agent found and `[data-testid=compare-line]` plus `[data-testid=differ-lead]` on The final test.
- **By hand**: with the app running, replay a run to its end and open both tabs. With the fake model the figures differ from the design's; to see the design's exact figures, run the Playwright test with `--headed` and pause after the crafted run loads.

## Check the 0.5 boundary

Vitest drives `tooClose` and `choiceView` at gaps of 0.49 (too close), 0.5 (not) and 1.2 (not) on both exams. In the browser, `found.spec.ts` and `final.spec.ts` serve crafted runs at those gaps and assert that `[data-testid=too-close]` is present only for 0.49.

## Check the rest

- **Labels**: both tabs show a banner with a pill under the lead; every score has "on the check seasons" or sits under a VALIDATION or TEST label.
- **No "winner"**: Playwright reads the visible text of both tabs for an AI run, a no-AI run (pick the "Unreliable" model) and a run where the pick lost the test, and fails on the word.
- **Layout**: at 360 px the banners wrap under their pills, the two cards and the three reasons stack, and the page does not scroll sideways; the leads are as wide as the container.
- **Contrast**: the Playwright contrast test computes the ratio from the page's own colours for the pills, banners, cards and panels in light and dark.
