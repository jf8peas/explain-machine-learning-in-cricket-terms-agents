# Tasks: Hero Chart: Context, Prediction and a Zoom on the Finish

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/hero-chart.md](contracts/hero-chart.md), [research.md](research.md), [design/README.md](design/README.md) (authoritative for layout and copy; `hero-zoom.html` is a picture only)
**Tests**: requested in the planning brief (pytest, Vitest on pure functions, Playwright with the fake model; no test calls a real model).
**Paths**: all relative to `apps/linear_regression/` unless stated. Run Python with `../../.venv/Scripts/python`.
**Rules**: every number from `/api/reference`; no figure typed into the page; series told apart by shape, line style and label as well as colour; nothing animates.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US6 from the spec

---

## Phase 1: Setup

- [x] T001 Read the code and tests this feature touches and list in a scratch note which existing tests need updating: `web/src/page/{worm,worm-layout,hero}.ts`, `web/index.html` (hero and chart CSS), `backend/linreg/hero_text.py`, `web/tests/unit/{worm,worm-layout}.test.ts`, `web/tests/e2e/hero.spec.ts`, `tests/test_hero_text.py`; grep `web/tests` and `tests` for `worm-end-label`, `worm-key`, `worm-miss-label`, `labelMode`, `drawKey`, `Mode`, `"side"`, `"key"`, `thin`, `bar`, `barLabel`, `caption` so every test to change is known before editing
- [x] T002 [P] Create the shared cases file `web/tests/fixtures/miss_words_cases.json`: a list of `{actual, tv, words}` including `{186, 164, "22 runs short"}`, `{150, 171, "21 runs over"}`, `{180, 180, "spot on"}`, `{181, 180, "1 run short"}`, `{179, 180, "1 run over"}`, a large gap each way, and equal values at 0 (it is read by Vitest and pytest, as `recipe_cases.json` is)
- [x] T003 [P] Create example fixtures for the chart tests in `web/tests/unit/worm-fixtures.ts`: `current` (82/2 at 10 overs, final 186, TV 164, know-nothing 162, average miss 22.5, wickets at overs 2, 10, 19, 20 with a 20-value `runs` array), `close` (TV and know-nothing within 2 runs, for example TV 164 and know-nothing 163), `tvOver` (TV above the actual total, for example TV 171 and actual 150), `spotOn` (TV equals the actual total), and `lowTotals` (all values small so the miss band goes past the plotted values); each as a `WormInput` builder taking overrides

---

## Phase 2: Foundational (blocks all user stories)

- [x] T004 Extend `web/src/page/worm-layout.ts` per [data-model.md](data-model.md): `Mode = "wide" | "narrow"` and `layoutMode(cardWidth)` replacing `labelMode` (same threshold, `NARROW_BELOW` unchanged), `ZOOM_PAD = 2`, `ZOOM_STEP = 10`, `zoomRange(values, averageMiss)` (lo = nearest 10 at or below min − pad over actual, TV, know-nothing, TV − miss and TV + miss; hi the nearest 10 at or above max + pad; at least one 10-run interval; ticks every 10 inclusive) and `missWords(actual, tv)` ("<n> runs short" when the TV is below the total, "<n> runs over" when above, "1 run" singular, "spot on" when equal); leave `yAxis` and `spreadLabels` as they are; keep `labelMode` exported as an alias returning the old `"side"`/`"key"` values, and keep the old `Mode` type in `web/src/page/worm.ts` with the old drawing unchanged, so `worm.ts` and the existing `worm.test.ts` (which call `wormPlan(input, "side")` and `"key"`) still type-check until T011 to T014 replace them; T013 then removes the alias
- [x] T005 [P] Vitest in `web/tests/unit/worm-layout.test.ts` (replace the `labelMode` cases, keep the `yAxis` and `spreadLabels` cases): `layoutMode` at 559, 560 and 561 px; `zoomRange` for `current` (range contains 140 to 190 with padding and ticks every 10), `close`, `tvOver`, `lowTotals` (the TV's miss band goes past the plotted values and the range still contains it), all values equal (at least one interval), a value on an exact multiple of 10 (never on an edge: at least 2 runs of room); `missWords` over every case in `miss_words_cases.json` plus symmetry and singular "1 run" (depends on T002, T003, T004)
- [x] T006 [P] Add the tokens and header changes in `web/index.html`: `--context-band` (light `#eef0f3`, a darker dark-theme neutral), `--context-line` (light `#8a93a3`, a lighter dark-theme neutral that keeps 3:1 against the dark band), `--on-accent` (white in the light theme; a dark colour in the dark theme where the accent `#6ea8ff` is light, chosen so the agent box text keeps 4.5:1); confirm `.hero-head`, `.hero-lead` and `.hero h1` carry no `max-width` and no `text-wrap: balance` and that no ancestor rule adds one; no animation
- [x] T007 [P] Backend wording helper in `backend/linreg/hero_text.py`: add `miss_words(actual: int, tv: int) -> str` with the same rule and wording as `missWords` (reuse the module's `_plural` style for "1 run"), and pytest in `tests/test_hero_text.py` that runs it over every case in `web/tests/fixtures/miss_words_cases.json` (read relative to the repo; skip nothing) (depends on T002)

**Checkpoint**: the app builds; the layout maths and the shared cases are tested; the chart looks as before.

---

## Phase 3: User Story 1 - See where each prediction lands (P1) 🎯 MVP

**Goal**: the zoom panel exists as a plan and a drawing, with separate labels, the miss bracket, the usual-miss bar and the agent box.
**Independent test**: Vitest on the zoom plan for several innings; the drawn zoom's figures equal the example's displayed values.

- [x] T008 [US1] Add `zoomPlan(input, geometry)` to `web/src/page/worm.ts` per [data-model.md](data-model.md): the zoom card rectangle, `range` from `zoomRange`, a `scale(value)` to y on the ruler band, the ruler with ticks every 10, the markers for actual, TV and know-nothing at their totals, the usual-miss bar from `scale(tv + averageMiss)` to `scale(tv − averageMiss)` with text "TV's usual miss, ±<average miss to one decimal>", the bracket from `scale(tv)` to `scale(actual)` with `missWords(actual, tv)` and its direction, the three labels ("Actual <total>", "TV <projection>", "Know-nothing <guess rounded>") placed by `spreadLabels` inside the ruler band (the band reserves a foot area for the agent box and the key), the agent box placed as a fourth wish in `spreadLabels` below the lowest label and above the key, the key rectangle, and the title ("ZOOM ON THE FINISH", "total after 20 overs"); pure and deterministic; export it without wiring it into `wormPlan` yet
- [x] T009 [US1] Add `drawZoom(zoom)` to `web/src/page/worm.ts`: the white card with the border colour and rounded corners, the ruler and tick labels, the actual diamond, the TV's filled orange dot and the know-nothing's open grey dot, the pale orange usual-miss bar and its key swatch, the orange bracket with its bold TV-coloured words, the three labels (actual bold in the text colour, TV bold in the TV colour, know-nothing regular and muted; labels about 15 px and 14 px for know-nothing at the desktop chart width), and the agent box (solid accent fill, text in `--on-accent`, "The agent: ?" bold over "where will it land?"); test ids per [contracts/hero-chart.md](contracts/hero-chart.md) (`worm-zoom`, `worm-zoom-ruler`, `worm-zoom-tick`, `worm-zoom-marker`, `worm-zoom-label`, `worm-zoom-miss`, `worm-zoom-key`, `worm-zoom-bracket`, `worm-zoom-bracket-words`, `worm-zoom-agent`); series told apart by shape and label as well as colour; text only, nothing animates (depends on T008)
- [x] T010 [P] [US1] Vitest in `web/tests/unit/worm.test.ts` (new `describe("zoomPlan")`): for `current`, `close`, `tvOver`, `spotOn` and `lowTotals`: the three labels are at least the label gap apart and inside the ruler band for every case, and for a sweep of many (actual, TV, know-nothing, miss) combinations; the agent box overlaps no label box and not the key and lies between the lowest label and the key; the usual-miss bar spans exactly `scale(tv + miss)` to `scale(tv − miss)` (and its text carries the unrounded average miss to one decimal); the bracket spans `scale(tv)` to `scale(actual)` and its words equal `missWords(actual, tv)` (short, over, spot on, and "spot on" draws no bracket length); every marker lies inside the ruler with room to spare; labels read "Actual 186", "TV 164", "Know-nothing 162" for `current`; the plan is deterministic (same input twice gives equal plans) (depends on T003, T008)

**Checkpoint**: the zoom is a tested plan and drawing, ready to be placed beside the line graph.

---

## Phase 4: User Story 2 - Read the first 10 overs as context (P1)

**Goal**: the line graph separates context from prediction, shows what actually happened as a solid line, drops the end labels and error bar, and sits beside the zoom at 60/40 in one SVG.
**Independent test**: measure even over spacing and the panel split automatically; judge the band and headings by eye.

- [x] T011 [US2] Rewrite the line graph part of `wormPlan` in `web/src/page/worm.ts` per [data-model.md](data-model.md): wide geometry for one SVG 700 units wide and 330 units high (never taller when rendered than the old 760 by 360 chart, so the existing "top of the model picker is in view at 1280 by 800" test still holds; the line graph panel `[0, 0.60 W]` including its axis labels, zoom card `[0.60 W + 0.01 W, W]`), `overX` placing all 20 overs evenly, the `context` rectangle (overs 0 to 10) and the `prediction` rectangle (10 to 20), `contextLine` (0 to 10), `actualLast10` (10 to 20, replacing `thin`), wickets with their band (`context` for overs 1 to 9, `prediction` for 11 to 19, none at 10 or 20), the 10-over dot and its "<runs>/<wickets>" label, the finish line x and the actual, TV and know-nothing markers on it, the `lens` box spanning the zoom range on the line graph's y scale and clamped to the plot's top and bottom (the zoom range pads up to 12 runs beyond the highest value, so `hi` can exceed the axis maximum), the two `joins` from the lens top and bottom to the zoom card's top-left and bottom-left corners, the headings (["CONTEXT", "first 10 overs"], ["THE PREDICTION", "where will the last 10 overs take it?"]), and `layout: "split"`, `shares: {line: 0.60, zoom: 0.39}`; `wormPlan` now includes `zoom` from `zoomPlan`; remove the old `thin`, `bar`, `barLabel`, `labels` and `EndLabel`; keep `wormPlan` pure and deterministic (depends on T008)
- [x] T012 [US2] Rewrite `drawWorm` in `web/src/page/worm.ts` to return the SVG(s) for a plan: wide returns one SVG drawing the context band (fill `--context-band`) with its two-line heading ("CONTEXT" small caps muted over "first 10 overs"), the prediction area (the surface colour) with its heading ("THE PREDICTION" small caps in the text colour over "where will the last 10 overs take it?"), the y axis and gridlines (unchanged), the x axis labels 0, 5, 10, 15 and "20 overs" (the last bold), the dotted line at 10 overs with the dot and its label, the context runs line in `--context-line` at 3 px with grey wicket circles, the solid text-colour runs line from 10 to 20 at 3 px (no faded opacity) with open text-colour wicket circles and the label "what actually happened" placed entirely in the white area above the line, the TV's dashed and the know-nothing's dotted lines from the dot to 20 overs, the solid finish line at 20 overs with the diamond, the TV's dot and the know-nothing's open dot, the lens box and the two faint `worm-join` lines, then `drawZoom(plan.zoom)` inside the same SVG; remove the end labels, the error bar and `drawKey`; keep `data-testid="worm-chart-svg"`, `role="img"`, `aria-label` = the server's chart text, `data-mode`; add the test ids in [contracts/hero-chart.md](contracts/hero-chart.md) (`worm-line`, `worm-context`, `worm-context-heading`, `worm-prediction`, `worm-prediction-heading`, `worm-ten`, `worm-series-context`, `worm-series-actual`, `worm-actual-label`, `worm-series-tv`, `worm-series-nothing`, `worm-finish`, `worm-finish-actual`, `worm-finish-tv`, `worm-finish-nothing`, `worm-lens`, `worm-join`) (depends on T009, T011)
- [x] T013 [US2] Update `mountWorm` in `web/src/page/worm.ts` to use `layoutMode` (and remove the `labelMode` alias T004 left), draw `drawWorm`'s result into the host, and redraw when the card crosses the breakpoint (narrow drawing is finished in US5); remove `drawKey` and its imports; confirm `web/src/page/hero.ts` needs no change; update the chart CSS in `web/index.html` (`.worm` block sizing, remove the `.worm-key*` rules, add the context and zoom styles that tokens and test ids need, with the labels' sizes in SVG units so they render about 15 px at the desktop width) (depends on T012)
- [x] T014 [P] [US2] Vitest in `web/tests/unit/worm.test.ts` (update the old `wormPlan` cases that checked end labels, the error bar, `thin` and the key geometry; keep the ones about the dot, wickets and axis): for `current` and two other innings the gap between consecutive overs is identical for all 20 and over 10 is halfway; the line graph panel is 60% of the width and the zoom card 39% within 1 percentage point; wickets at overs 2 (context) and 19 (prediction) land in the right band and are not drawn at 10 or 20; the context rectangle spans overs 0 to 10 and the prediction rectangle 10 to 20; the lens spans exactly the zoom range on the line graph's y scale, and is clamped inside the plot for a high-total innings (for example total 199 so the zoom range reaches 210) and a very low one; the two joins start at the lens top and bottom and end at the zoom card's top-left and bottom-left corners; no end labels or error bar fields exist in the plan; the plan is deterministic (depends on T003, T011)
- [x] T015 [US2] Playwright in `web/tests/e2e/hero.spec.ts` (update the tests that checked the old end labels, error bar and key: "the chart shows the end labels…", "the end labels never overlap…", and the pieces of the narrow and number checks that named them): at 1280 px the line graph and zoom are both present (`worm-line`, `worm-zoom`) and measured at 60% and 39 to 40% of the chart's width within 1 point; the over labels `0`, `5`, `10`, `15`, `20 overs` are present and the gap between consecutive over ticks is equal; the context band and prediction area headings read as the README says; the actual line after 10 overs is solid (no `stroke-opacity` below 1); no `worm-end-label`, `worm-key` or `worm-miss-label` exists; the two `worm-join` lines exist in wide mode; the wicket circles at the example's wicket overs are in the right band (depends on T013)

**Checkpoint**: the hero shows the line graph and the zoom side by side.

---

## Phase 5: User Story 3 - Caption and text equivalent (P2)

**Goal**: the server's caption and chart text describe the new chart.
**Independent test**: pytest on the three caption variants and the chart text.

- [x] T016 [US3] Rewrite `caption()` in `backend/linreg/hero_text.py` per [plan.md](plan.md): "A real innings: <batting> v <bowling>, <venue>, <date_label>. The first 10 overs, in grey, are context; the white part is what everyone is trying to predict. <batting> went from <runs_at_10>/<wickets_at_10> to <final_total>. The TV's straight line said <tv_projection> and was <miss_words(final_total, tv_projection)>" (so "…and was 22 runs short", "…and was 21 runs over" or "…and was spot on"), followed, only when `about_typical_miss` says so (called with the whole-number gap `abs(final_total - tv_projection)`, not the float `example["tv_miss"]`, so the clause and the direction use the same number), by ": about its typical miss", then ". Open circles mark wickets."; direction and size come from `miss_words(final_total, tv_projection)`, not from `example["tv_miss"]` (depends on T007)
- [x] T017 [US3] Extend `chart_text()` in `backend/linreg/hero_text.py`: keep the existing sentences and add the zoom: where the actual total, the TV projection and the know-nothing guess landed at 20 overs, the miss in the same words as the bracket, and the TV's usual miss as a band either side of its projection ("The zoom on the finish shows ..."); every number is one of the inputs (depends on T016)
- [x] T018 [P] [US3] pytest in `tests/test_hero_text.py` (update `test_the_caption_is_built_from_the_example`, `test_without_the_clause_the_caption_ends_the_sentence_plainly`, `test_the_chart_text_has_every_number_the_chart_shows_and_says_the_agent_is_unknown` and the numbers-are-inputs test for the new wording): the three caption variants (TV short, TV over, spot on) each with and without the typical-miss clause; the fixed context sentence and "went from <runs>/<wickets> to <total>" appear; "Open circles mark wickets." ends it; the direction and size equal `miss_words`; `chart_text` mentions the zoom, the miss words, the TV's usual miss and that the agent's prediction is not known; every number in both is one of the inputs for at least three innings; without an example both are `None` and the panel stays (depends on T016, T017)
- [x] T019 [US3] Playwright in `web/tests/e2e/hero.spec.ts`: the caption on the page equals `hero.caption` from `/api/reference` and contains "The first 10 overs, in grey, are context; the white part is what everyone is trying to predict."; the SVG's `aria-label` equals `hero.chart_text` and mentions the zoom; the bracket words on the page appear in the caption (the page and the server agree) for the example served, and for crafted routed responses with the TV over the total and with the TV equal to it (depends on T013, T016)

---

## Phase 6: User Story 4 - Title and description at full width (P2)

**Goal**: the hero title fits one line at 1280 px and the header copy uses the container's full width.
**Independent test**: measure the title and the header against their container.

- [x] T020 [US4] Playwright in `web/tests/e2e/hero.spec.ts` (measured at analysis time: the 44 px title's natural width is about 1047 px in a 1068 px box, so it already fits one line with about 20 px to spare; the test guards that and fails if a later rule narrows the box or wraps it): at 1280 px the title's rendered height equals one line (its `getClientRects` or height against its line-height), the title, the lead and the header are as wide as the hero container within 1 px, and no computed `max-width` is set on them and `text-wrap` is not `balance` on the title (depends on T006)

---

## Phase 7: User Story 5 - Narrow screens (P2)

**Goal**: below the narrow threshold the zoom sits under the line graph at full width and replaces the old key.
**Independent test**: Playwright at 360 px.

- [x] T021 [US5] Add the narrow plan and drawing in `web/src/page/worm.ts`: `wormPlan(input, "narrow")` returns `layout: "stacked"` with a narrow line-graph geometry (about 340 units wide, all 20 overs evenly spaced, smaller type) and a zoom geometry at full width below it, the lens kept and `joins: []`; `drawWorm` returns two SVGs (`worm-chart-svg` for the line graph and `worm-zoom-svg` for the zoom, each `width: 100%; height: auto`); `mountWorm` redraws when the card crosses 560 px; add the narrow CSS in `web/index.html` (stack with a small gap, headings wrap, no sideways scroll at 360 px, `.worm-card` padding as today) (depends on T013)
- [x] T022 [P] [US5] Vitest in `web/tests/unit/worm.test.ts`: the narrow plan has `layout: "stacked"`, no `joins`, over spacing still even, the zoom's labels, agent box and key still never overlap for `current`, `close`, `tvOver` and `lowTotals`, and the plan is deterministic; the same input and mode give an identical plan; the wide and narrow plans carry the same labels and miss words (depends on T021)
- [x] T023 [US5] Playwright in `web/tests/e2e/hero.spec.ts` (update the phone-width test that referred to the key and the narrow chart): at 360 px there are two SVGs, `worm-zoom` is below `worm-line` (its top is at or below the line graph's bottom) at the line graph's full width, there is no `worm-key` and no `worm-join`, and `document.documentElement.scrollWidth <= 360`; at 559 and 560 px the mode follows the threshold (depends on T021)

---

## Phase 8: User Story 6 - Different innings and missing data (P2)

**Goal**: the chart copes with any example and with missing data.
**Independent test**: Playwright with routed `/api/reference` responses.

- [x] T024 [US6] Playwright in `web/tests/e2e/hero.spec.ts` with routed responses (the existing helper that changes the real response): a close TV and know-nothing (within 2 runs) and a TV above the actual total each show three non-overlapping `worm-zoom-label` boxes (bounding boxes do not intersect), the agent box intersects no label and not the key, and the bracket words equal `missWords` of the displayed values (read from `miss_words_cases.json`-style expectations computed in the test from the response); a TV equal to the actual total shows "spot on"; the usual-miss bar's `data-from` and `data-to` equal TV − miss and TV + miss and its pixel span matches the ruler's tick spacing within 1 px; with no example innings, caption or chart text the chart card is hidden, no number is shown for it, and the TV panel stays; the existing "figures change" and "no example innings" tests are updated only for the new ids (depends on T013)

---

## Phase 9: Polish and cross-cutting

- [x] T025 Playwright contrast test in `web/tests/e2e/hero.spec.ts` (use `contrastOf` from `web/tests/e2e/helpers.ts`): in light and dark, `worm-zoom-label` (each series), the usual-miss key text, the bracket words, the zoom title and ticks, the headings, the axis labels and the agent box text (against the box fill) are each at least 4.5:1, and the context line against the context band is at least 3:1; if a value fails, adjust `--context-line`, `--context-band` or `--on-accent` in `web/index.html` until it passes (depends on T013)
- [x] T026 Playwright in `web/tests/e2e/hero.spec.ts`: nothing in the chart is animated (`getAnimations` empty, transition durations 0), series are told apart by more than colour (the TV line is dashed and the know-nothing line dotted, the three zoom markers have three shapes, each label carries its name), and every number in the hero's chart text is one of `/api/reference`'s figures or derived from them (the bracket's figure, the ticks, the range) (depends on T013)
- [x] T027 Update the remaining existing specs only where they checked the old layout, labels or caption (and confirm the "top of the model picker is in view at 1280 by 800" test passes unchanged with the new chart height): `web/tests/e2e/hero.spec.ts` leftovers (the "every number in the hero equals the server's figures" test, the "figures change" test and any `worm-end-label` expectation), `web/tests/e2e/tabs.spec.ts` and `web/tests/e2e/stages.spec.ts` if they name the old key (grep first), and the README paragraphs in `README.md` that describe the chart's end labels, error bar or key (depends on T015, T019, T021)
- [x] T028 Full verification: `../../.venv/Scripts/python -m pytest` in `apps/linear_regression`, then in `web/` `npm run test`, `npm run build` and `npx playwright test`; confirm the other tabs, the TV panel, the three steps and the live summary line are unchanged (their tests pass untouched); grep `web/src` and `web/tests` for stale references (`worm-end-label`, `worm-key`, `worm-miss-label`, `drawKey`, `labelMode`, `"side"` and `"key"` modes, `EndLabel`, `barLabel`) and fix any; confirm no new dependency was added
- [ ] T029 Walk through [quickstart.md](quickstart.md) in a browser: the current example, a close TV and know-nothing case, a TV-over case and a spot-on case at 1280 px, then 360 px and both themes; mark the manual success criterion SC-009 (a visitor can say where the actual total landed, where the TV landed and how far off it was within a few seconds) for a person to judge

---

## Dependencies

- Phase 1 → Phase 2 → stories. T004 (layout maths) blocks T008; T006 (tokens) blocks T020, T025.
- **US1** (T008–T010) builds the zoom as a plan and drawing without wiring it. **US2** (T011–T015) wires both panels into `wormPlan`/`drawWorm`/`mountWorm` and removes the end labels, error bar and key. **US5** (T021–T023) adds the narrow stack and needs US2. **US3** (T016–T019) is backend wording and is independent of the drawing until the Playwright check T019. **US4** (T020) is independent after T006. **US6** (T024) needs US2.
- T004 keeps the build green by mapping the old modes in `worm.ts` until T011 to T013 replace the drawing.

## Parallel opportunities

- T002, T003, T006 and T007 are different files; T005, T010, T014, T018 and T022 are test-only tasks on separate files once their code lands.
- The backend wording (T016–T018) can run alongside any front-end story.
- US4's CSS check (T020) can run alongside US1 to US3.

## Implementation strategy

1. **MVP** = Phases 1, 2, 3 and 4: the zoom, the two-panel line graph and the removal of the old end labels. That alone fixes the cramped finish.
2. Add US3 (caption and text), US5 (narrow), US4 (title) and US6 (cases), then polish.
3. After each phase run pytest and Vitest; run Playwright at the end of each story. The full Playwright suite takes under three minutes when run alone.
