# Implementation Plan: Cricket Silhouettes

**Branch**: `024-cricket-silhouettes` (work is on `main`; no branch hook ran) | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)
**Input**: The specification and [design/README.md](design/README.md) (authoritative; the canvas, including `PhoneHero.dc.html` and `PhoneWorm.dc.html`, is a visual reference only). Decisions are in [research.md](research.md), the tokens and elements in [data-model.md](data-model.md), the interface and testable guarantees in [contracts/ui.md](contracts/ui.md), and the checks in [quickstart.md](quickstart.md).

## Summary

Decoration only. A faint bowler sits behind everything in the dark hero band, sized by a CSS function of the band's width so he is identical at the simple and "Show me everything" levels, top-anchored and clipped by the band. On a phone the crop is anchored on his head (30% of his width in, at the band's centre, clamped edge to edge). The goal card and hero Commentary gain a 3 px frosting. A faint batter is blended (multiply on light, screen on dark) over the run-by-over chart and sized to the chart area with `contain`, so on a phone he shrinks to fit rather than being cut. Both are empty `aria-hidden` spans painted from alpha-mask SVGs by colour tokens, absolutely positioned and not printed. No wording, number, term, test id, state key, backend or dependency change.

## Technical Context

**Language/Version**: TypeScript 5 (Vite 5, no framework, custom elements); CSS
**Primary Dependencies**: none new
**Storage**: none
**Testing**: Vitest (static checks in `web/tests/unit`), Playwright (`web/tests/e2e`, scripted fake models); pytest untouched
**Target Platform**: 390 × 664 phones up to desktop, light and dark; Chromium verified; Safari via `-webkit-mask` and `-webkit-backdrop-filter`
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: none; two static images of about 5 and 16 KB, no JavaScript at runtime
**Constraints**: no wording/number/term/test-id/state-key change; 021's banned terms and 022's word limits hold; the h1, goal sentence and Start button fit 390 × 664 without scrolling; 020's contrast check gains the two tints; no layout shift; no horizontal scroll; the main page only
**Scale/Scope**: 1 new CSS file, 1 new TS helper, 2 SVG copies, edits to `hero.ts`, `problem.ts`, `theme.css`, `main.ts` (CSS import), the contrast helper and spec; 1 new e2e spec, 1 new unit test

## Constitution Check

No constitution exists, so there are no gates. Carried principles: no new dependency; identifiers and test ids are not renamed; every number still comes from the backend (none are added); colour lives in `theme.css` tokens, never in the shape files or as literals in rules.

**Re-check after design**: no violations. Flags: (1) the batter is an overlay above the chart rather than strictly behind it (R1; spec amended); (2) the bowler's "about 94%" is calibrated against the band at the "everything" level at reference widths, not recomputed live (R2); (3) both SVGs carry an inert C2PA metadata block (R6).

## Project Structure

### Documentation

```text
specs/024-cricket-silhouettes/
├── plan.md
├── research.md             # R1 to R9
├── data-model.md           # tokens, constants, the two elements
├── quickstart.md
├── contracts/ui.md         # DOM, guarantees G1 to G9, style rules
├── checklists/requirements.md
├── design/                 # README.md is authoritative; assets/ are the shapes; canvas/ is reference
└── tasks.md                # created later by /speckit-tasks
```

### Source (all under `apps/linear_regression/web`)

```text
src/page/silhouettes/bowler-silhouette.svg   # new: copied unchanged from design/assets
src/page/silhouettes/batter-silhouette.svg   # new: copied unchanged
src/page/silhouette.css                      # new: masks, hero clip, bowler size and crop, batter overlay, frosting, print
src/page/silhouette.ts                       # new: silhouette(kind) returns the empty aria-hidden span
src/page/theme.css                           # + 5 tokens, dark override of the blend
src/page/hero.ts                             # bowler span as first child in renderHero's replaceChildren
src/page/problem.ts                          # wrap the chart host in div.worm-stage, add the batter span
src/page/main.ts                             # import silhouette.css after simple.css
tests/e2e/silhouettes.spec.ts                # new
tests/e2e/helpers.ts                         # contrastOf: tint layers (R7)
tests/e2e/contrast.spec.ts                   # add the hero and chart selectors the tints affect
tests/unit/silhouette.test.ts                # new: static checks
```

`worm.ts`, `worm-layout.ts`, the backend, `under-the-hood*` and all copy are not touched.

## Phases

1. **Calibrate** the bowler (R2): throwaway script; write `(k, b)` per range and the crossover width.
2. **Build**: tokens; copy the SVGs; `silhouette.ts`; `silhouette.css`; hero and problem wiring.
3. **Test**: the new spec (G1 to G9, accessibility, print), the contrast extension, the unit checks; run the existing suites unchanged.
4. **Open items**: image rights and the optional metadata strip (below).

## Open items

- **Image rights**: both silhouettes were traced from press photos supplied by John. Confirm the traced outlines may be used, or replace them with licensed or self-shot silhouettes (same placement rules), before the site goes public.
- **C2PA metadata**: both SVGs embed a content-credentials block from the design tool; optionally strip it (about half the bytes) once the rights question is settled.
