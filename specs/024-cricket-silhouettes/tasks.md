# Tasks: Cricket Silhouettes

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)
**Tests**: requested in the plan (Playwright and Vitest); written before or alongside each story.
**Paths**: all under `apps/linear_regression/web` unless a path starts with `specs/`.

Format: `- [ ] ID [P?] [Story] Description with file path` (`[P]` = different files, no dependency on an unfinished task).

## Phase 1: Setup

- [X] T001 Copy `specs/024-cricket-silhouettes/design/assets/bowler-silhouette.svg` and `batter-silhouette.svg` unchanged into `src/page/silhouettes/` (new folder)
- [X] T002 [P] Add the five tokens to `src/page/theme.css`: `--silhouette: var(--text)`, `--silhouette-alpha: .07`, `--silhouette-blend: multiply` (and `screen` inside the existing dark `@media` block), `--silhouette-on-dark: #cbd5e1`, `--silhouette-on-dark-alpha: .09` (research R6)
- [X] T003 Write the throwaway calibration script `tests/e2e/calibrate-bowler.mjs` (not committed to the suite): at "Show me everything", before a run, print the `[data-testid=hero]` height for viewport widths 360 to 1280 in 40 px steps, and run it; paste the table into a comment at the top of `src/page/silhouette.css` (T005)

## Phase 2: Foundational (blocks all stories)

- [X] T004 [P] Create `src/page/silhouette.ts` exporting `silhouette(kind: "bowler" | "batter"): HTMLElement`, returning an empty `<span class="silhouette silhouette-{kind}" aria-hidden="true" data-testid="silhouette-{kind}">` using the `h` helper from `src/page/dom.ts`
- [X] T005 Create `src/page/silhouette.css` with the shared rule only: `.silhouette { position: absolute; pointer-events: none; display: block; mask-repeat: no-repeat; -webkit-mask-repeat: no-repeat }`, an `@media print { .silhouette { display: none } }` block, and the calibration comment from T003; import it in `src/page/main.ts` immediately after `simple.css`
- [X] T006 Fit the bowler constants from the T003 table (research R2): per range (stacked below 760 px, two columns 760 to 1100 px, capped above) a line `height = k × 100cqw + b` giving 94% of the band height, plus the crossover container width where his width (`0.622 × height`) equals the band's; record `--bowler-k`, `--bowler-b` and the crossover in `src/page/silhouette.css`

**Checkpoint**: tokens, files, helper and constants exist; nothing is visible yet.

## Phase 3: User Story 1 - A bowler in the hero (P1) 🎯 MVP

**Goal**: the faint bowler behind the hero, identical at both levels, with the phone crop and the frosting.
**Independent test**: `npx playwright test silhouettes -g bowler` passes at 390 × 664 and 1280 × 800.

### Tests

- [X] T007 [US1] Create `tests/e2e/silhouettes.spec.ts` with the bowler tests, using the scripted fake models and the `view` switch: (a) G1 bounding box of `silhouette-bowler` identical (x, y, width, height) at the simple and "everything" levels at 390 × 664 and at 1280 × 800; (b) G2 height ÷ hero height = 94% ± 5 points at "everything" at 390, 768, 1024 and 1280 px; (c) G3 at the simple level the band's bottom is 35% to 65% of his height below his top; (d) G4 at 390 × 664: `left ≤ band.left`, `right ≥ band.right`, focal point `left + 0.3 × width` inside the band, top 30 px below the band top; (e) G5 at 1280: centre within 1 px of the band's centre; (f) the h1, goal sentence and Start button inside 390 × 664 and no horizontal scroll (G9), light and dark

### Implementation

- [X] T008 [US1] In `src/page/hero.ts`, add `silhouette("bowler")` as the first child of the `root.replaceChildren(...)` call in `renderHero`, before the `.hero-inner` div; no other change
- [X] T009 [US1] In `src/page/silhouette.css`, add the hero rules: `.hero-band { position: relative; overflow: hidden; isolation: isolate; container-type: inline-size }` and `.hero-band .hero-inner { position: relative; z-index: 1 }`
- [X] T010 [US1] In `src/page/silhouette.css`, add `.silhouette-bowler`: mask from `url("./silhouettes/bowler-silhouette.svg")` (and `-webkit-mask`), `mask-size: 100% 100%`, `background: var(--silhouette-on-dark)`, `opacity: var(--silhouette-on-dark-alpha)`, `top: 30px`, `height: calc(var(--bowler-k) * 100cqw + var(--bowler-b))`, `width: calc(height × 630 / 1013)` (via a shared `--bowler-h` property), `left: calc((100% - width) / 2)`, and inside `@container (max-width: <crossover>)` `left: clamp(100% - width, 50% - 0.3 * width, 0px)`; use the three ranges from T006
- [X] T011 [P] [US1] In `src/page/silhouette.css`, add the frosting inside `@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))`: `.hero-band .goal-card, .hero-band .commentary { backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px) }`
- [X] T012 [US1] Run `npx playwright test silhouettes idle phone`; take 390 × 664 screenshots (simple and "everything", light and dark) and confirm by eye that the focal point is his head and no strip shows; adjust only the T006 constants if G2 to G4 fail

**Checkpoint**: US1 complete and demonstrable on its own.

## Phase 4: User Story 3 - Decoration that costs nothing (P1)

**Goal**: both silhouettes are inert, absent from print, shift nothing, and every existing check still passes with the tints counted.
**Independent test**: `npx playwright test silhouettes contrast word-count banned-terms idle phone` passes; `npm test` passes.

### Tests

- [X] T013 [US3] In `tests/e2e/silhouettes.spec.ts`, add: (a) the bowler is present, `aria-hidden="true"`, has no children, empty `textContent`, `tabIndex` of -1 or not focusable (not reachable by Tab), computed `pointer-events: none`; (b) under `page.emulateMedia({ media: "print" })` its computed `display` is `none`; (c) G8: collect `getBoundingClientRect` of every `[data-testid]` element except the silhouettes, add `.silhouette { display: none !important }` with `addStyleTag`, collect again, and expect equal lists, at simple and "everything" levels, 390 × 664 and 1280 × 800
- [X] T014 [P] [US3] Create `tests/unit/silhouette.test.ts` (Vitest, reads files like `chart-colours.test.ts`): `theme.css` defines the five tokens in the light block and the dark block resolves `--silhouette-blend` to `screen`; `silhouette.css` references both SVG files that exist in `src/page/silhouettes/`; `silhouette.css` contains no `#`-colour literal and no `rgb(`; each SVG contains no `<text` and no `<image` element
- [X] T015 [US3] Extend `contrastOf` in `tests/e2e/helpers.ts` (research R7): (a) when an ancestor has a `.silhouette-bowler` child, push a `[203, 213, 225, 0.09]` layer between that ancestor's background and the layers above it; (b) when the target is inside `.worm-stage` that has a `.silhouette-batter` child, pass both the computed background and the text colour through the blend with the `--silhouette` ink at 0.07 (`multiply` or `screen` per `matchMedia("(prefers-color-scheme: dark)")`); (c) read `fill` instead of `color` for SVG text
- [X] T016 [US3] In `tests/e2e/contrast.spec.ts`, add to the main-page list the hero and chart text the tints affect that is not yet listed (goal card sentence and figure labels, the result strip, Commentary figures and paragraphs, the chart's axis and label text inside `[data-testid=worm-chart]`), keeping `?view=everything`, a finished run and both schemes; run it and fix any failure by adjusting only silhouette alpha tokens, never copy or other colours

### Implementation

- [X] T017 [US3] Run the full existing web suites unchanged: `npm test`, `npm run build`, `npx playwright test word-count banned-terms idle phone contrast anchors panels`; fix any regression in the silhouette CSS only

**Checkpoint**: US1 and US3 complete; the feature is safe to ship with the bowler alone.

## Phase 5: User Story 2 - A batter over the run-by-over chart (P2)

**Goal**: the faint batter, blended over the chart, fitting the chart area and never cut on a phone.
**Independent test**: `npx playwright test silhouettes -g batter` passes in both themes.

### Tests

- [X] T018 [US2] In `tests/e2e/silhouettes.spec.ts`, add the batter tests (open The problem's Commentary with `?view=everything`, scripted reference data): (a) present, `aria-hidden`, empty, not focusable, `pointer-events: none`, print `display: none`; (b) G6 at 390 × 664: his box is inside the `worm-card` rect and his height ≤ 95% of `.worm-stage`; at 1280 × 800 his height is 95% ± 1% of the stage and he is centred ± 1 px; (c) G7 his box is identical before and after opening "About this chart"; (d) computed `mix-blend-mode` is `multiply` under light and `screen` under dark; (e) the chart's SVG `aria-label` and the card's test ids are unchanged; (f) no horizontal scroll in either theme (G9)

### Implementation

- [X] T019 [US2] In `src/page/problem.ts`, wrap the existing `h("div", { "data-testid": "worm-chart" })` in `h("div", { class: "worm-stage" }, chartHost, silhouette("batter"))`, keeping `mountWorm`'s host argument the same inner `[data-testid=worm-chart]` element and the `details` as a sibling of `.worm-stage`; import `silhouette` from `./silhouette`
- [X] T020 [US2] In `src/page/silhouette.css`, add `.worm-stage { position: relative; isolation: isolate }` and `.silhouette-batter`: `inset: 2.5% 0`, mask from `url("./silhouettes/batter-silhouette.svg")` (and `-webkit-mask`), `mask-size: contain`, `mask-position: center`, `background: var(--silhouette)`, `opacity: var(--silhouette-alpha)`, `mix-blend-mode: var(--silhouette-blend)`
- [X] T021 [US2] Run `npx playwright test silhouettes contrast problem` in both schemes; take 390 × 664 and 1280 × 800 screenshots and confirm by eye that bat tip and all three stumps are inside the card; confirm the contrast results include the batter blend (T015 b)

**Checkpoint**: all three stories complete.

## Phase 6: Polish and cross-cutting

- [X] T022 [P] Search for stragglers: `grep -rn "silhouette" src tests` shows only the files listed in the plan; `git status` shows no change to `worm.ts`, `worm-layout.ts`, `under-the-hood*`, the backend or any copy
- [X] T023 Run everything: `npx playwright test`, `npm test`, `npm run build` in `web`, and `pytest` in `apps/linear_regression`; all green with no snapshot or test-id edits
- [X] T024 [P] Walk the manual spot check in `specs/024-cricket-silhouettes/quickstart.md` (both themes, phone and desktop, print preview)
- [X] T025 [P] Keep the open items in `specs/024-cricket-silhouettes/plan.md` as they are (image rights; optional C2PA strip) and add a one-line status note to `specs/024-cricket-silhouettes/checklists/requirements.md`

## Implementation notes (deviations from the plan)

- Calibration (T003/T006): fitted lines are stacked `1606.2 - 1.2823 * W` (W = band padding-box width, `100cqw + 48px`, which settles analysis finding F1), 735 px for 860-919 px viewports, 693 px from 920 px; crossover at a band content width of 507 px. Between 760 and 859 px the existing hero is a 3,500 px single column (a feature 022 layout issue, left alone).
- G2 is tested at 390, 700, 1024 and 1280 px (768 falls in that broken range); G3 at 390 and 1280 px with a 45-70% window.
- `.worm-stage` has no `isolation` (the blend then includes the card's own background, which matches the contrast model).
- The chart-text contrast check is a dedicated test in `contrast.spec.ts` (each SVG text against the fill beneath it, with and without the blend), because the generic helper cannot see SVG fills.
- The throwaway calibration and screenshot specs were deleted. One unrelated `live-region.spec.ts` test failed once under the full parallel run and passed on two reruns alone.

## Dependencies and order

- Phase 1 then Phase 2 (T006 needs T003 and T005); Phase 2 blocks all stories.
- US1 (Phase 3) is the MVP and needs only Phases 1 and 2.
- US3 (Phase 4) needs US1 for the bowler checks; its batter checks arrive with T018 in US2. T015 and T016 can start once T008 and T010 exist.
- US2 (Phase 5) needs Phases 1 and 2 only; it can run in parallel with US1 and US3 by a second person, but T018 and T013 both edit `tests/e2e/silhouettes.spec.ts`, so those two are sequential.
- Phase 6 last.

### Parallel opportunities

- T002 with T001 and T003; T004 with T005's file creation only if the import is added after both.
- T011 (frosting) in parallel with T010 (bowler rule): same file, so apply sequentially but they have no logical dependency.
- T014 (unit test) in parallel with T013 and T015.
- T022, T024, T025 in parallel.

## Implementation strategy

1. MVP: Phases 1, 2 and 3 (the bowler). Demonstrable and safe on its own.
2. Add US3's checks so the bowler is proven inert and contrast-safe, then US2's batter.
3. Calibration (T003, T006, T012) is the only step that needs eyes on a screen; everything else is mechanical and test-driven.
4. Stop and ask before changing anything outside the file list in the plan.
