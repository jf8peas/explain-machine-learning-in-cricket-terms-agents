# Quickstart: checking the broadcaster wording

Run from `apps/linear_regression`. Everything uses the scripted fake models; no key and no network.

## Before editing: the phone baseline

1. Start the app as in feature 022's quickstart and open `/` at 390 × 664 (or run `npx playwright test idle`).
2. Record the h1's height and the Start button's bottom edge. After the change they are compared with these.

## After editing

1. **Backend**: `pytest` from `apps/linear_regression`. Expect the updated wording tests, the new banned-term, reply-check and "no literal TV" tests, and all older tests green.
2. **Front end units**: `npm test` in `web` (Vitest), including `no-literal-terms` and the updated wording fixtures.
3. **End to end**: `npx playwright test` in `web`. It includes:
   - `idle.spec.ts`: the h1, goal sentence and Start button inside 390 × 664, no horizontal scroll;
   - `broadcaster-wording.spec.ts`: every row of the design README's examples table, on a finished fake-model run, with the numbers and years from the backend;
   - `banned-terms.spec.ts` and the word counts: both pages, simple and everything open, before a run and after a fake-model run.
4. **Search**: with a finished fake-model run open on both pages, search the page text, aria-labels, titles and preview tags for the word "TV". Expect none outside the agent's quoted reasoning. `grep -rnw TV backend/linreg web/src web/*.html README.md` should return nothing.

## Manual spot check

- Open `/`, read the h1 and lead; open the browser tab title and view the preview tags.
- Press Start, Play, and watch the "Right now" line during the baseline step: "Code is scoring the broadcaster's projection and the average-total guess".
- After the run: the result strip, the verdict heading, the bars key, the rule of thumb and "Your turn" all say broadcaster.
- Turn "Show me everything" on: the hero Commentary says "Knowing the score at 10 overs barely helps the broadcaster, and on average it guesses too low…".

## If the Start button no longer fits

Set the phone h1 to 1.75rem in `web/src/page/simple.css` (line 27), keep 2.5rem at the wide breakpoint, re-run `idle.spec.ts`. Do not shorten the copy.

## Results (2026-10-23, after implementation)

- `pytest`: 1,180 passed. `npx tsc --noEmit`: clean. `npx vitest run`: 426 passed. `npx playwright test`: 284 passed.
- `grep -rnw TV` over `backend`, `web/src`, `web/*.html` and `README.md`: only the fake model's `old_name` option and the banned patterns themselves.
- Words (simple view, after a fake-model run): 495 of 500. Everything open: 1,191 of 1,200. How this app was built: 410 simple, 1,085 everything open.
- Phone first screen (390 × 664): the Start button's bottom edge is 659.0 px at a 1.75rem phone h1 (712.7 px at 2rem); see research R5.
- Departures from the design README's examples table, because the code never had the README's wording: the hero Commentary has no "How good is the broadcaster?" heading (its sentence reads "Knowing the score at 10 overs barely helps the broadcaster, and on average it guesses too low…"); the rule of thumb reads "When the broadcaster shows a projected score, …" or "The broadcaster's projection is about right on average…", not "Take the broadcaster's projection, then add …" (that is the canvas's wording); the "Right now" baseline line is "Code is scoring the broadcaster's projection and the average-total guess".
