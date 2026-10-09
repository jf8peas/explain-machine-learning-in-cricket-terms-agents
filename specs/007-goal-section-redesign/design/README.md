# Handoff: Goal section redesign (option 1a, "Miss meter")

## Overview
Replace the busy intro block at the top of `apps/linear_regression/web/index.html` (the `section.intro` with `.intro-body` two-paragraph grid and `.intro-ref` goal + reference table) with a lighter version: one sentence, a number line of average miss, a row of labelled chips, and two collapsible `<details>` holding the full original text and table.

## About the design files
`goal-section-1a.html` is a **design reference in HTML** (inline styles for portability), not production code. Recreate it in the existing app: plain HTML in `index.html`, CSS classes in its `<style>` block using the existing variables (`--bg --surface --border --text --muted --accent --win --win-bg`) so dark mode keeps working, and DOM built in `web/src/page/reference.ts` via the existing `h()` helper.

## Fidelity
High-fidelity. Colours, type and spacing are final and use the page's existing tokens.

## Layout (top to bottom, inside `section.intro`)
1. **Eyebrow nav**: unchanged (`.eyebrow`).
2. **h1**: unchanged text; margin-bottom 6px.
3. **Lead line**: `<p>` muted, max-width 70ch, margin 0 0 20px. Copy: "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by 3 runs less on average." Build "3" from `goal.margin_runs`.
4. **Miss meter card**: border 1px `--border`, radius 10px, padding 18px 20px 14px, column flex with gap 6px.
   - Top row (0.8rem, muted, space-between): "← better" | "Average miss, runs · {first_year} to {last_year}, {innings} innings" | "worse →".
   - Track area: position relative, height 92px.
     - Base line: absolute, top 36px, height 2px, full width, `--border`.
     - Goal zone: absolute, left 0, width = pos(goal), top 30px, height 14px, `--win-bg` fill, 1px `--win` border, radius 4px 0 0 4px.
     - Three markers, absolutely positioned at `left: pos(v)%`, `translateX(-50%)`, column-centred:
       - label (0.8rem, 600, nowrap), then a 12px dot (margin-top 12px), then value (1.4rem, 700, line-height 1.2, margin-top 10px, tabular-nums).
       - TV projection: colour `--text`. Know-nothing guess: colour `--muted`.
       - Goal: colour `--win`; instead of a dot, a 2px × 32px vertical line (margin-top 2px), label "The goal".
   - Footer (0.85rem, muted, border-top 1px `--border`, padding-top 10px, margin-top 4px): "**{margin} runs** better than TV, on the latest calendar year, which nothing was trained or chosen on." (bold part in `--text`).
5. **Chip row**: flex wrap, gap 8px, margin-top 14px, font 0.9rem. Each chip: 1px `--border`, radius 999px, padding 3px 12px, nowrap; bold term + muted description. The language-model chip uses `--accent` for border and term.
   - Agent: a LangGraph graph of steps
   - Language model: picks features
   - Code: makes every number
   - Linear regression: runs per unit
   - Rival: forward selection
6. **`<details>` "How this works, in full"**: margin-top 12px, 0.95rem; summary in `--accent`. Body: the two original `.intro-body` paragraphs verbatim, muted, max-width 75ch, gap 8px.
7. **`<details>` "Full figures for the two simple guesses"**: margin-top 6px. Body: the existing `reference-table` (unchanged columns and styling, max-width 720px) and the existing reference note sentence.

## Scale maths
Scale runs from 15 to 32 runs: `pos(v) = (v − 15) / 17 × 100`. Today: goal 18.8 → 22.4%, TV 21.8 → 40%, know-nothing 29.4 → 84.7%. Better: derive the domain from data, e.g. `min = floor(goal − 4)`, `max = ceil(knowNothing + 3)`, so markers never clip.

## Data (all from `/api/reference`; nothing hard-coded)
- `goal.margin_runs` (3), `figures.broadcaster.average_miss` (21.8), `figures.know_nothing.average_miss` (29.4)
- Goal value = `broadcaster.average_miss − goal.margin_runs` (18.8), rounded to 1 dp to match displayed figures (see `goal.py`, which computes from displayed one-decimal values)
- `training.first_year/last_year/innings` for the scale caption
- `sentences.*` and `figures` for the table and note inside the second `<details>`
- Error state: keep the current behaviour. If the fetch fails, hide the meter and show the existing `.reference-error` message.

## Interactions
- Only the native `<details>` toggles; both closed by default. No animation.
- Keep `aria-live="polite"` on the region that `reference.ts` fills. Give the meter an `aria-label` / sr-only sentence, e.g. "Average miss: know-nothing 29.4, TV projection 21.8, goal 18.8 or less."
- Keep the existing `data-testid`s (`goal`, `reference`, `reference-table`, `reference-row`, `reference-lead`, `reference-note`) so e2e tests in `web/tests/e2e/reference.spec.ts` still find them; move `goal` onto the meter footer.

## Responsive
Below 760px, shrink the marker value to 1.1rem and hide the "← better / worse →" end labels if they collide; the chips already wrap.

## Tokens (light; dark comes from the existing `prefers-color-scheme` block)
`--bg #ffffff`, `--surface #f6f7f9`, `--border #d5d9e0`, `--text #1b2230`, `--muted #5b6678`, `--accent #1d6fe0`, `--win #1f7a46`, `--win-bg #e4f3ea`. Font: system-ui 16px/1.55. Radii 4 / 10 / 999px.

## Files
- `goal-section-1a.html`: standalone reference of option 1a
- Source being replaced: `apps/linear_regression/web/index.html` (`section.intro`), `web/src/page/reference.ts`, `backend/linreg/goal.py`
