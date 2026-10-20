# Implementation Plan: Hero Chart: Context, Prediction and a Zoom on the Finish

**Branch**: `017-hero-zoom` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its 2026-10-20 clarification), the approved design in [design/README.md](design/README.md) (authoritative over `hero-zoom.html`, which is a picture only), and the planning brief.

## Summary

Redraw the hero's worm chart as one chart card with two panels: a line graph (60% of the width) with all 20 overs evenly spaced, a grey context band for overs 0 to 10 and a white prediction area for overs 10 to 20; and a "Zoom on the finish" panel (40%) that magnifies where each prediction lands at 20 overs. The work is front-end drawing and layout maths (`worm-layout.ts`, `worm.ts`), some CSS in `index.html`, and two server sentences (`hero_text.caption` and `hero_text.chart_text`). `/api/reference` is used exactly as feature 013 built it: no field is added, nothing new is fetched, and the only figures worked out beyond what the server sends are the miss (actual minus TV, displayed), the zoom range and its ticks. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript, no framework (web)
**Primary Dependencies**: existing only (FastAPI; Vite, Vitest, Playwright). No new dependency
**Storage**: none; the hero reads `/api/reference` once
**Testing**: pytest (`test_hero_text.py`), Vitest on the pure plan functions (`worm-layout.test.ts`, `worm.test.ts`; no DOM library is installed, so DOM checks are Playwright), Playwright with the fake model (`hero.spec.ts`); no test calls a real language model
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: the chart is drawn once and again when the card crosses the narrow breakpoint; a few dozen SVG elements, so imperceptible
**Constraints**: every number from `/api/reference`; the miss in the bracket is the displayed actual minus the displayed TV projection; series told apart by shape, line style and label as well as colour; 4.5:1 text contrast in both themes (3:1 for the grey context line against its band); nothing animates; no sideways scroll at 360 px; with no example innings the chart card is left out; the other tabs, the TV panel and the three steps unchanged; the OpenRouter key never reaches the browser (untouched)
**Scale/Scope**: 2 web modules rewritten (`worm-layout.ts` extended, `worm.ts` redrawn), `hero.ts` untouched in behaviour, 1 backend file (`hero_text.py`), CSS for the hero, 3 test files updated and 2 new data files

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | Every figure is a field of `/api/reference` (listed below); the short/over/spot-on rule is defined twice (server sentence, page bracket) and kept in agreement by one shared cases file that both test suites read |
| No numbers typed into the page | Only number-free copy is typed (headings, key, "The agent: ?"); the bracket's figure, the ruler's labels and the usual-miss key are worked out from the server's values |
| Wording never contradicts figures | `missWords` and the server's caption use the same displayed whole numbers; the shared cases file covers short, over, spot on and the edges |
| A failure never shows invented numbers | Missing example, figures or average miss leaves the chart card out, as today |
| Deterministic layout | `wormPlan` and the zoom plan are pure: the same input and mode always give the same plan |
| No new dependencies | none |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/017-hero-zoom/
├── plan.md
├── research.md            # one SVG or two; the zoom range rule; keeping missWords and the caption in agreement; the narrow layout
├── data-model.md          # the plan and zoom-plan types
├── quickstart.md          # run the suites; check the example innings, a close TV/know-nothing case and a TV-over case by eye
├── contracts/hero-chart.md # the chart's DOM and data-testid contract, extending feature 013's
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
└── hero_text.py            # CHANGED: caption() and chart_text(); a small miss_words() the caption uses

tests/
├── test_hero_text.py       # CHANGED: caption's three variants (short, over, spot on) with and without the typical-miss clause; chart_text mentions the zoom; the shared miss-words cases
└── (fixture) web/tests/fixtures/miss_words_cases.json   # NEW: actual, tv, expected words; read by pytest and Vitest

web/src/page/
├── worm-layout.ts          # CHANGED: zoomRange(), missWords(), layoutMode() (was labelMode); spreadLabels, yAxis, NARROW_BELOW unchanged
├── worm.ts                 # CHANGED: wormPlan (all 20 overs evenly, context/prediction, finish line, lens), zoomPlan, drawWorm (both panels); drawKey removed
└── hero.ts                 # UNCHANGED in behaviour (still passes example, averageMiss, averageTotal, chartText to mountWorm)

web/index.html              # CHANGED: no max-width on the hero header, lead and title, no text-wrap: balance; tokens --context-band and --context-line (light and dark); --on-accent for the agent box text; styles for the zoom, the narrow stack, the removed key
web/tests/
├── unit/worm-layout.test.ts, worm.test.ts   # CHANGED where they checked the old end labels, error bar, key or geometry; new cases below
└── e2e/hero.spec.ts        # CHANGED where it checked the old layout, labels or key; new cases below
```

## Design notes

- **Data the chart uses** (all from `/api/reference`, unchanged): `example.runs`, `example.wicket_overs`, `example.runs_at_10`, `example.wickets_at_10`, `example.final_total`, `example.tv_projection`, `average_total`, `figures.broadcaster.average_miss`, `hero.caption`, `hero.chart_text`. `example.tv_miss` is still sent and still used by the server's caption. Nothing new is fetched, and nothing is calculated beyond: the miss (`final_total − tv_projection`, whole runs), the zoom range and its ticks, and the pixel places that come from them.
- **Modes**: `layoutMode(cardWidth)` returns `"wide"` (card at least `NARROW_BELOW`, 560 px) or `"narrow"`. Wide draws one SVG whose plot splits 60/40; narrow draws two stacked SVGs. See [research.md](research.md) §1 for why one SVG and two.
- **Chart size**: the wide viewBox is 700 by 330 units, no taller when rendered than the old 760 by 360 chart, so the hero still leaves the model picker in view at 1280 by 800.
- **Line graph** (wide): the panel is the left 60% of the SVG including its axis labels; over `o` sits at `left + o/20 × (right − left)`, so spacing is identical everywhere and over 10 is halfway. The context band is the rectangle for overs 0 to 10; the prediction area, the surface colour, for 10 to 20. The 0 to 10 line and its wicket circles use the context-line token; the 10 to 20 line is solid in the text colour (the old `thin` series and its faded opacity go). Wickets after 10 overs are open circles in the text colour.
- **Zoom** (both modes): a card with the ruler near its left, ticks every 10 runs, the usual-miss bar just right of the ruler, the bracket, the three labels placed by `spreadLabels`, the agent box and the key. The vertical extent is divided into a ruler band (markers, bar, bracket, labels) and a reserved foot band (agent box and key), so the agent box can never overlap a label or the key. The agent box is placed as a fourth wish in `spreadLabels` bounded above the key, so the same helper guarantees spacing.
- **Lens** (both modes): a small box on the finish line spanning the zoom's range on the line graph's own y scale; in wide mode two faint lines join its top and bottom to the zoom card's top-left and bottom-left corners (same SVG). In narrow mode the lens stays and the joining lines are dropped.
- **Server caption** (`hero_text.caption`): `A real innings: <batting> v <bowling>, <venue>, <date>. The first 10 overs, in grey, are context; the white part is what everyone is trying to predict. <batting> went from <runs_at_10>/<wickets_at_10> to <final_total>. The TV's straight line said <tv_projection> and was <n> runs short|over<": about its typical miss" when the existing rule says so>. Open circles mark wickets.` When the TV equals the total the middle reads "said <tv_projection> and was spot on." The direction comes from `final_total − tv_projection` on the displayed whole numbers.
- **Text equivalent** (`hero_text.chart_text`): the existing sentences, plus the zoom: where the actual total, the TV projection and the know-nothing guess landed at 20 overs, the miss in words, and the TV's usual miss as a band either side of its projection.
- **Header copy**: `.hero-head`, `.hero-lead` and `.hero h1` carry no `max-width`; `text-wrap: balance` is removed from the title (it is not set today in the title rule, so the check is that no ancestor or rule reintroduces it; measured today, the 44 px title is about 1047 px wide in a 1068 px box, so it fits one line with about 20 px to spare); at 1280 px the 44 px title fits one line.

## Tests

- **Vitest** (`worm-layout.test.ts`, `worm.test.ts`): `zoomRange` on at least three innings (the current example; TV and know-nothing within 2 runs; TV above the actual total) plus all values close together and the TV's miss band past the plotted values; `missWords` for short, over and spot on (and 1 run, singular), read from the shared cases file; no two zoom labels overlap and the agent box overlaps neither a label nor the key, swept over many value combinations; even over spacing on the line graph; the usual-miss bar spans exactly TV ± miss on the zoom's scale; the two panels split 60/40 within 1 percentage point; wickets land in the right band and colour (grey up to over 10, text colour after); `wormPlan` is deterministic.
- **pytest** (`test_hero_text.py`): the caption's three variants (short, over, spot on), with and without the typical-miss clause; the fixed context sentence and "went from"; `chart_text` mentions the zoom; every number in both is one of the inputs; the shared miss-words cases.
- **Playwright** (`hero.spec.ts`, fake model): both panels present at 1280 px and measured 60/40 within 1 point; the title on one line at 1280 px; at 360 px the zoom sits under the line graph with no sideways scroll; 4.5:1 contrast of the zoom labels, the key and the agent box in both themes (computed from the page's own colours; 3:1 for the context line against its band); the chart card left out with no example innings; the displayed bracket words equal the shared cases for the example served, including a crafted TV-over and a crafted close TV/know-nothing example.
- Existing worm, hero and hero_text tests change only where they checked the old layout, end labels, error bar, key or caption.
