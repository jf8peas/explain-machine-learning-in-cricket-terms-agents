# Quickstart: Hero Chart Zoom

From `apps/linear_regression`:

```bash
# Backend: the caption's variants and the chart text
../../.venv/Scripts/python -m pytest tests/test_hero_text.py

# Whole backend suite
../../.venv/Scripts/python -m pytest

# Front end (from web/)
npm run test                 # Vitest: worm-layout, worm
npm run build                # type-check and bundle
npx playwright test hero.spec.ts      # then the whole suite: npx playwright test
```

## Look at the chart by eye

Start the app as for earlier features and open The Run tab (it is the default). Check, at a 1280 px window:

1. **The current example** (Australia v India, Sydney, December 2020): the line graph (left) has a grey band for overs 0 to 10 headed "CONTEXT · first 10 overs" and a white area for overs 10 to 20 headed "THE PREDICTION · where will the last 10 overs take it?"; the actual line after 10 overs is solid; a solid finish line at 20 overs carries the diamond, the TV dot and the know-nothing open dot; a small lens box on it joins two faint lines to the zoom panel on the right. In the zoom: the ruler with ticks every 10 runs, three separate labels ("Actual 186", "TV 164", "Know-nothing 162"), the orange bracket "22 runs short", the pale orange usual-miss bar with its key, and the blue "The agent: ?" box with white text.
2. **A close TV and know-nothing case**: serve a crafted reference with the TV and the know-nothing guess within 2 runs (for example TV 164 and know-nothing 163). `hero.spec.ts` does this with a routed `/api/reference`; to see it yourself, run `npx playwright test hero.spec.ts -g "close" --headed`. The two labels stay apart and neither touches the agent box.
3. **A TV-over case**: the same with the TV above the actual total (for example TV 171 and actual 150): the bracket reads "21 runs over", the labels stay apart, and the caption says "was 21 runs over".
4. **Spot on**: TV equal to the total: the bracket reads "spot on" and the caption says "was spot on".

Then narrow the window to 360 px (or open the browser's device toolbar): the zoom drops under the line graph at full width, the old key is gone, there is no sideways scroll, and the title still wraps naturally.

## Check the rules

- **60/40**: `hero.spec.ts` measures the two panels' rectangles and asserts 60% and 39 to 40% within 1 point.
- **Title on one line**: at 1280 px the title's height equals one line.
- **Contrast**: the Playwright test computes the ratio from the page's own colours in both themes (4.5:1 for the labels, key and agent box; 3:1 for the context line against its band).
- **Agreement**: `miss_words_cases.json` is read by pytest and Vitest, and a Playwright test checks the bracket text appears in the caption.
