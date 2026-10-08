# Research: How Good Is the Reference? Accuracy Against Real Totals

Date: 2026-10-09. Figures below were computed on the **training years only** (2005 to 2024, 4,036 innings) from the committed data, so nothing here peeks at the validation or test year. No new dependency is needed for any decision.

## What the training years say (and what it means for the design)

| Method | Average miss | Within 10 runs | Within 20 runs | Miss as share of a typical total | Bias |
|---|---|---|---|---|---|
| Know-nothing guess (average total 155.3) | 29.4 | 22.8% | 43.1% | 18.9% | 0.0 |
| Broadcaster's projection | 21.8 | 29.4% | 55.3% | 14.1% | −12.1 (too low) |

Three things follow:

1. **The projection is clearly better than knowing nothing**: its average miss is 25.9% lower (7.6 runs of 29.4, worked out from the displayed figures; the unrounded figures give 25.7%). The "barely better or worse" wording (FR-009) is a rule that must exist but will not fire on this data.
2. **The projection is a strongly biased guess**: it runs about 12 runs too low on average, because teams score faster in the last 10 overs than at the halfway rate. That is exactly the kind of fact the "bias" measure is for, and it is a good teaching point: a straight-line model can fix a bias that "run rate × 20" cannot.
3. **Only about three innings in ten land within 10 runs** even for the projection. The "within 10 runs" measure will give visitors a realistic sense of how hard the problem is.

## Decision 1: One accuracy function, and how figures are rounded

`backend/linreg/accuracy.py` (generic, a shared-library candidate, no cricket words) has one function, `accuracy(actual, predicted)`, returning unrounded figures:

| Key | Meaning |
|---|---|
| `n` | number of innings |
| `average_miss` | mean of \|predicted − actual\| |
| `within_10`, `within_20` | percentage of innings with \|predicted − actual\| ≤ 10, ≤ 20 (inclusive; a tiny allowance for floating-point noise, so exactly 10.0 counts) |
| `miss_percent` | `average_miss` ÷ mean of actual × 100 |
| `bias` | mean of (predicted − actual); positive means too high |

`TOLERANCES = (10, 20)` is a named constant, so the key names and the tolerances come from one place. Predictions are never rounded before the figures are worked out.

`display(figures)` in the same module rounds for storage and display: runs and bias to **1 decimal**, percentages to **1 decimal**. Everything stored in state and sent by the endpoint is already rounded this way, so a reader can reproduce any derived number from the page.

**Alternative considered**: store unrounded and round in the browser. Rejected: the browser and the explanation text would each round on their own, and could disagree by 0.1.

## Decision 2: The "large bias" rule

`LARGE_BIAS_SHARE = 0.5` in `accuracy.py`: a method has a **large bias** when `|bias| ≥ 0.5 × average_miss` (and the average miss is above zero). `is_large_bias(figures)` and `same_direction_large_bias(list_of_figures)` live beside it, and every place uses them.

On the training data: the projection's bias is 12.1 against an average miss of 21.8 (55%), so it is **large** and low; the know-nothing guess's bias is 0.0, so it is not. The know-nothing guess is the training average, so its bias is near zero by construction and would stop "every method has a large bias in the same direction" from ever applying. The finding therefore looks only at the methods that use the score at 10 overs: the projection and the agent's models (two or three methods). The caller passes that subset to `same_direction_large_bias`, which stays generic. The rule is tested on made-up numbers, since on the real data it may not apply.

**Alternative considered**: a bias of at least some fixed number of runs. Rejected: what counts as large depends on how big the misses are, so a share of the average miss scales with it.

## Decision 3: The know-nothing guess

`know_nothing_guess(train_totals, n)` in `evaluation.py` (shared, generic) returns the mean of the given training totals repeated `n` times. It is given training rows only by every caller (the endpoint, `baseline`, `final_test`), and a test checks that changing validation or test values does not change it.

## Decision 4: The four methods, defined once

`backend/linreg/methods.py` (app-specific) holds a tuple of four definitions, in the order they are shown:

| id | Display name | Technical note | Chart marker |
|---|---|---|---|
| `know_nothing` | the know-nothing guess | always the training years' average final total (a constant baseline) | open square |
| `broadcaster` | the TV projection | the broadcaster's projected score: current run rate × 20 overs | open circle |
| `llm` | the language model's model | a straight line fitted on the features the language model picked | open triangle |
| `forward` | forward selection's model | a straight line fitted on the features forward selection picked | open diamond |

The endpoint sends these definitions to the page; the explanation reads the names from them; the chart key and the table rows use the same objects. The page already calls the projection "the TV projection" in several places and in tests, so that is its display name; "the broadcaster's projection" appears in the technical note.

State keys for the two existing contenders (`llm`, `forward`, and `tv` inside `test_mae`) are unchanged for compatibility; the new `final.accuracy` uses the four ids above, with `broadcaster` for what `test_mae` calls `tv`.

## Decision 5: The goal, defined once

`backend/linreg/goal.py` (app-specific) builds one goal object from `MARGIN_RUNS`:

- `reference`: `broadcaster`, `margin_runs`: 3, and its wording: "beat the TV projection by at least 3 runs of average miss, on the latest calendar year, which nothing was trained or chosen on."
- `verdict(reference_figures, winner_figures)` returns the improvement in runs, the improvement as a percentage of the reference's average miss, whether it beat the reference, and whether it reached the goal.

**All verdict arithmetic uses the rounded, displayed figures**: improvement in runs = the projection's displayed average miss minus the winner's, rounded to 1 decimal; the percentage = that improvement ÷ the projection's displayed average miss × 100, to 1 decimal; "reached" means the displayed improvement is at least 3.0. A reader can therefore check every verdict from the table on the page (SC-006). The cost is a rounding edge: an unrounded improvement of 2.96 shows as 3.0 and counts as reached. I judged a verdict a reader can reproduce to be worth more than one that is exact but cannot be checked.

The old `final.beat_tv`, `final.cleared_margin` and `final.improvement` keys are kept and now take their values from this verdict, so there is one truth. The winner between the language model and forward selection is still decided on the unrounded test errors, as today (unchanged behaviour and tests).

`index.html`'s hand-written goal paragraph is removed; the page shows the goal text it receives from `/api/reference` (Decision 7).

## Decision 6: When is the projection "barely better" or "worse"?

`CLEARLY_BETTER_SHARE = 0.10` in `goal.py` (named, used everywhere): the projection is **clearly better** than the know-nothing guess when its average miss is at least 10% lower; **only slightly better** when it is lower by less than that; **no better** when it is equal or higher. On the training data it is 25.9% lower, so the introduction will say "clearly better" and show the 7.6-run gap.

## Decision 7: `GET /api/reference`

A new app-specific router (`reference_api.py`), same cache headers as `/api/data` (`public, s-maxage=3600, stale-while-revalidate=86400`, added to `vercel.json`). It loads the data, makes the existing three-way split, and uses **only the training slice**. Its response (full shape in `contracts/api.md`) holds the goal, the four method definitions, the know-nothing and projection figures, the training years and innings count, the gap, and the plain-language sentences the introduction shows. Every sentence is built by code from the figures (Decision 10), so the page types no number.

The result is computed once per process and kept (as the structure extras are). If the data cannot be read the response still carries the goal and the method names with `figures: null` and a short message, so the introduction can show the goal with a "figures could not be loaded" note. If the request itself fails (the server is unreachable) the page cannot know the goal, because the goal exists only in the backend; it then shows only the "could not be loaded" note. I judged that right: the alternative is typing the goal into the page, which the brief rules out, and when the server is unreachable nothing else on the page works either.

## Decision 8: What the agent's steps add

- **`baseline`** scores the know-nothing guess on the validation year with `accuracy()` (the guess is the training mean, so it reads the training slice), stores `reference_validation` (both references' figures), and adds one sentence to its summary. It never reads the test year.
- **`final_test`** is still the only reader of the test slice. It scores, once each, the know-nothing guess, the projection, and the language model's and forward selection's fitted models, and adds to `final`: `accuracy` (figures per method), `methods` (the ids present, in the display order), `identical` (pairs of methods whose predictions are the same), `bias_finding`, and `verdict`. It also adds `method_defs` (the definitions of the methods present, so the results table and the chart never depend on the introduction's request having succeeded) and `reference_finding` (the clearly / only slightly / no better finding for the projection against the know-nothing guess on the test year, with its sentence, so the results can say so as FR-009 requires). Chart points go in a **separate top-level state key** `chart_points` so that `final` stays small: `{actual: [...], predicted: {method: [...]}}`, each value rounded to one decimal, for transport only (the figures are worked out from the unrounded predictions).
- **Fallback**: if the language model did not take part, `llm` is absent from `methods`, `accuracy` and `chart_points`, and `final.llm_took_part` is false as today.
- **Identical predictions** (exactly equal after allowing floating-point noise) are both kept and listed in `identical`; the key says so, and because chart marks are open shapes both stay visible.

## Decision 9: The explanation

`cricket_explanation.py` gets new sentences, all from `final.accuracy`, `final.verdict` and the method definitions: how far the winner beats the know-nothing guess (runs and the hit rate within 10 runs), how far it beats the projection, the winner's bias in words, and the "same large bias" finding when it applies. The existing sentences stay; the verdict sentence's wording comes from the goal object. The fixed expectation note ("no method can predict a final total perfectly from the halfway mark…") is **page text** in the results area, not a figure and not in the explanation.

## Decision 10: One module for the wording

`backend/linreg/accuracy_text.py` (app-specific, plain cricket language) turns figures into words: "guesses 6.2 runs too low", "lands within 10 runs in 31% of innings", the gap sentence, the "clearly better / only slightly better / no better" sentence, and the large-bias sentence. The endpoint, the explanation and the final state all call it, so a number is never worded two ways.

## Decision 11: The state panel and long arrays

`<graph-replay>`'s state panel prints every value with `JSON.stringify`, which would print the 2,000 chart numbers. A new generic helper, `state-view.ts`, summarises any array longer than 20 items as "N items" at any depth (so `chart_points.predicted.llm` becomes "515 items") and leaves everything else as it is. It knows nothing about cricket; the brief's example wording "412 points" cannot be generic, so it says "items".

## Decision 12: The chart

A hand-built SVG in a new app-specific page module, `accuracy-chart.ts`, with pure helpers (`axisRange`, `niceTicks`, `markerFor`, `defaultSelection`) that Vitest tests.

- **Axes**: x is the actual final total and y the predicted one, so a method that guesses too low sits **below** the diagonal. Both axes use the same range, computed once from **every method's points** so toggling a method never rescales the chart, and so the range always covers every shown point. Ticks are "nice" numbers (steps of 1, 2, 2.5 or 5 times a power of ten) within the range. The plot is square and scales with its container (viewBox plus `width: 100%`), so on a phone it just gets smaller.
- **Marks**: one open shape per method (square, circle, triangle, diamond), stroke only with a low fill opacity, so dense regions look darker and identical predictions show as two marks. Colours come from the page's CSS variables in light and dark; the shape is what tells methods apart.
- **Toggles**: one real button per method with `aria-pressed`; the default selection is the winning model plus the projection; with nothing selected only the diagonal and a prompt appear; the language model's button is absent when it did not take part. The key shows each method's marker and name, and notes methods with identical predictions.
- **Text alternative**: the side-by-side table sits directly above the chart and holds every figure; a caption says what the chart shows in words ("one mark per test innings; marks below the line are guesses that were too low").
- **No animation.**

## Decision 13: The results table

Methods are rows. Columns: **Average miss** (mean absolute error), **Hit rate** (within 10 runs; within 20 runs), **Miss as a share of a typical total** (relative error), **Bias** (mean signed error), and **Innings**. Technical names appear once, in brackets in the column headings. Bias is shown as words and runs ("guesses 6.2 runs too low"). On a phone the table scrolls inside its own box. The existing three-number comparison box stays above it with its test ids (`comparison`, `final-llm`, `final-forward`, `final-tv`, `winner`, `verdict`) so existing tests keep passing; it gains the know-nothing figure and the verdict now reads from the goal object.

## Decision 14: Keeping the introduction short (SC-007)

I measured the page: in a 1280 × 800 window the Play button sits at 626 to 661 px, so about 130 px of height is free before it leaves the first screen. The new content is a passage of about two lines (~45 px) and a three-row compact table (header and two rows at a small size, ~85 px), about 130 px. To make room, the block **replaces** the current goal paragraph and the sentence "The benchmark is the broadcaster's projected score: current run rate × 20 overs" (now said by the block), which gives back about 20 px. If the measured Play bottom is still over 784 px, the first implementation task trims another sentence from the introduction before anything else is built; a Playwright test at 1280 × 800 is the arbiter.

## Decision 15: Existing tests

Existing keys and test ids are kept (see Decision 13). Tests that assert wording of the verdict sentence (`explanation.spec.ts`, `test_explanation_numbers.py`) keep passing if the phrase "beat the TV projection" stays in it, which it does. `structure.spec.ts` expects the goal paragraph to contain "at least 3 runs", which the new goal text does. Anything that changes only because a number is now rounded to one decimal before the verdict is adjusted deliberately, with the reason noted in the task.

## Open questions

None blocking. Two judgement calls to check when you first look at the page: the default chart selection (winner plus the TV projection) and the colour used for each method.
