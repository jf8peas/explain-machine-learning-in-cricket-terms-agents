# Quickstart: checking the cricket silhouettes

Run from `apps/linear_regression/web`. All tests use the scripted fake models; no key and no network.

## Before editing

1. Record the phone baseline: `npx playwright test idle` passes; note the h1 height and the Start button's bottom edge at 390 × 664.
2. Run the throwaway calibration script (task 1). It prints the hero band's height at "Show me everything", before a run, for widths 360 to 1280. Fit `(k, b)` per range and the crossover width, and write them in `silhouette.css`.

## After editing

1. `npm test` (Vitest): static checks (tokens exist in both themes, the silhouette rules hold no colour literal, the SVGs are mask-only with no text, both are referenced).
2. `npm run build` (type check and bundle; the SVGs are fingerprinted).
3. `npx playwright test silhouettes contrast idle phone word-count banned-terms`:
   - `silhouettes.spec.ts`: G1 to G9, presence, `aria-hidden`, not focusable, empty, hidden under `emulateMedia({ media: "print" })`;
   - `contrast.spec.ts`: every hero and chart text colour keeps 4.5:1 over the 9% and 7% tint, light and dark, every Commentary panel open;
   - the existing idle, phone, word-count and banned-term specs, unchanged.
4. `npx playwright test` (everything) and `pytest` from `apps/linear_regression` (nothing should change).

## Manual spot check

- `/` at 390 × 664, light and dark: a faint head and torso behind the h1, goal card and Start button; no scroll. Switch on "Show me everything": the band grows, the legs appear, the head has not moved.
- Desktop: centred behind the two-column hero; the goal card shows him softly through its frosting.
- Open The problem's Commentary: a faint batter and stumps across the chart; open "About this chart": he stays put.
- Print preview: neither appears.
