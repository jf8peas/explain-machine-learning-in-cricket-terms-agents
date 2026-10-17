# Research: Intro Hero

No `NEEDS CLARIFICATION` remained; these are the decisions the brief left open, and the facts checked while planning.

## Decisions

**1. Where the example is looked up.**
Decision: in `train`, the test-population innings before the first check year that `build_reference` already builds.
Rationale: the brief requires the example to come from the introduction's years; looking it up there makes a check-year, test-year or out-of-population innings impossible by construction, with no separate year test to get wrong.
Alternatives: look up in the whole file and compare years afterwards (two places to keep in step).

**2. How `rollup_match` yields per-over totals without changing its return value.**
Decision: optional `overs_out: list | None = None` on `rollup_match` and `process_zip`; the rows are appended only for kept innings.
Rationale: existing tests and callers use `(row, reason)` and `(rows, excluded, read)`; the loop already visits every delivery.
Alternatives: a larger tuple (breaks callers); a second pass (the brief says the same pass).

**3. Innings with fewer than 20 overs.**
Decision: record the overs that were bowled (an all-out innings has fewer rows); `example` is null if the chosen innings has fewer than 20.
Rationale: no invented rows; the spec says shortened innings are unsupported for the hero.

**4. Wicket overs.**
Decision: the server derives `wicket_overs` from the rise in cumulative wickets between consecutive overs: the overs in which at least one wicket fell, each listed once, in order.
Rationale: the design draws one open circle per such over. For the README's example (wickets in overs 2, 10, 19, 20, 20) the list is 2, 10, 19, 20, and the page then omits 10 and 20, leaving circles at 2 and 19.

**5. Rounding of `average_total`.**
Decision: the server sends `average_total` as a whole number of runs, rounded once in Python, and the page and the text equivalent both use that value.
Rationale: Python and JavaScript round halves differently; sending the rounded integer removes any chance of the label disagreeing with the server's sentences.
Alternatives: send one decimal and round in the page (risk of a mismatch the number check would catch late).

**6. Dark-mode TV colour and contrast.**
Light value: the README's `#b35c00` is 4.72:1 on `--bg` (#ffffff) but only **4.40:1 on `--surface` (#f6f7f9)**, which is the future region's fill and the panel background, where TV-coloured labels will sit. That fails 4.5:1.
Decision: light `--tv: #a85600` (5.26:1 on `--bg`, 4.90:1 on `--surface`). Dark `--tv: #e8913a` (7.38:1 on `--bg` #12161d, 6.58:1 on `--surface` #1b212b).
Alternatives: keep `#b35c00` and put TV labels only on `--bg` (constrains the layout); lighter dark value (more contrast than needed).
Action: the Vitest colour test (as for earlier tokens) asserts these ratios.

**7. Fold requirement.**
Risk: a 44 px headline, lead, tab bar, and a 2-column area can exceed 800 px before the model picker. Mitigation planned: chart plot about 280 to 320 px tall; the panel and steps beside it rather than below; tighten header margins; the Playwright test asserts the picker's top edge is below the hero and inside the viewport. If it cannot fit, the headline size drops (the README says "about 44 px") before the picker's position is changed.

**8. The breadcrumb.**
`VITE_SITE_URL` is already substituted in `index.html` (`%VITE_SITE_URL%`), so the link source exists. The current "App 1 of 8" wording is dropped because the README's breadcrumb is only site › Linear regression.

**9. Types.**
`accuracy.ts` and `accuracy-chart.ts` import `Figures` and `MethodDef` from `reference.ts`. Because that module is removed, the types move to `reference-types.ts`; no behaviour changes.

**10. Which e2e tests touch the removed introduction.**
`reference.spec.ts` (rewritten), `llm-run.spec.ts`, `stages.spec.ts`, `structure.spec.ts` and `catalogue.spec.ts` match on removed test ids or text (grep found `intro-lead`, `reference-`, `meter`, `chip`, `catalogue-details`). Tasks will list the exact tests after a targeted grep; only those are edited.

## Open items for tasks

- Regenerate the data (needs a network download); check which existing tests hard-code figures that move slightly.
- The Playwright fold test is the arbiter of the headline size and chart height.
