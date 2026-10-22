// Contrast (feature 020, FR-014): text on both pages, on the light and dark pages, in the dark bands and inside the graph, is at least 4.5:1
// against what is behind it, in the light theme and the dark theme, with every Commentary panel open.
import { expect, test, type Page } from "./fixtures";
import { contrastOf, finishRun } from "./helpers";

const MIN = 4.5;

const MAIN_TEXT = [
  // the header
  '[data-testid=breadcrumb] a', '[data-testid=breadcrumb] [aria-current]', '[data-testid=link-feedback] .label', '[data-testid=link-under-the-hood] .label', '[data-testid=view-switch] .label',
  // the hero, a dark band
  '[data-testid=hero-kicker]', '[data-testid=hero-title]', '[data-testid=hero-lead]', '[data-testid=start-experiment]',
  '[data-testid=goal-kicker]', '[data-testid=goal-sentence]', '[data-testid=goal-tv-figure]', '[data-testid=goal-target-figure]', '.goal-figure .what', '[data-testid=goal-judged]', '[data-testid=result-strip]', '[data-testid=result-link]',
  '[data-testid=hero-commentary] .commentary-label', '[data-testid=tv-sentence]', '[data-testid=tv-footnote]', '[data-testid=who-does-what]', '[data-testid=tv-miss]',
  // the problem
  '#problem .kicker', '[data-testid=problem-title]', '[data-testid=problem-lead]', '[data-testid=tile-score-at-10] .tile-value', '[data-testid=tile-score-at-10] .tile-label',
  '[data-testid=tile-tv-said] .tile-value', '[data-testid=problem-caption]',
  // watch it think
  '#watch .kicker', '#watch-title', '.loop-strip li:not(.ai)', '.loop-strip li.ai', '.loop-strip li.repeat', '[data-testid=play-button]', '[data-testid=watch-again]', '[data-testid=run-line]', '[data-testid=player-status]', '[data-testid=agent-explainer]', '.agent-legend .lg-ai',
  '.agent-question', '[data-testid=right-now] h3', '[data-testid=right-now-step]', '[data-testid=right-now-doing]', '.rn-row dt', '[data-testid=see-result]',
 '[data-testid=watch-commentary] h3', '[data-testid=watch-commentary] p', '.season-strip li', '.season-strip li.locked', '.round-n', '[data-testid=round-idea]',
  '[data-testid=model-reason]', '[data-testid=round-score]', '.status-tag.status-first_score', '.status-tag.status-new_best', '.status-tag.status-no_better', '.status-tag.status-rejected',
  '.status-tag.status-finished', '[data-testid=best-idea]', '[data-testid=model-note]', '.setup-chips li',
  // the graph (inside its shadow root)
  'graph-replay .row-title', 'graph-replay .row-note', 'graph-replay .node-name', 'graph-replay .node.actor-llm .actor-tag', 'graph-replay .stage-badge', 'graph-replay .row-loop',
  'graph-replay .legend-stage .name', 'graph-replay .legend-stage .question', 'graph-replay .panel h3', 'graph-replay .item-tag', 'graph-replay .item-node .node-name',
  'graph-replay .path > summary', 'graph-replay .raw > summary', 'graph-replay .toolbar button', 'graph-replay .timeline button', 'graph-replay .legend-note', 'graph-replay .loop-pill',
  // the verdict
  '#verdict .kicker', '[data-testid=verdict-title]', '[data-testid=verdict-vs-search]', '.vname', '.vvalue', '[data-testid=verdict-caption]', '[data-testid=rule-card] p', '[data-testid=rule-from]',
  '[data-testid=trust-toggle]', '[data-testid=trust-panel] li', '.vcard h3', '[data-testid=pick] p', '.exam-name', '.exam-value', '.exam-pill', '.close-name strong', '.close-bias', '.close-pct',
  '.close-key-item', '[data-testid=flatters]', '.bar-label', '.bar-value',
  // your turn, a dark band
  '#try .kicker', '#try-title', '#try .lead', '[data-testid=tryit-model-label]', '#try form label', '#try form .btn', '[data-testid=tryit-hint]',
  // the Scorebook and the footer
  '#scorebook .kicker', '#scorebook-title', '.sb-card strong', 'footer p', 'footer a',
];

const BUILT_TEXT = [
  '[data-testid=breadcrumb] a', '[data-testid=back-top] .label', '#hero .kicker', '#hero-title', '#hero .hero-lead', '.facts .num', '.facts .what', '.jump .pill-link',
  '.kicker', '#h-big', '[data-testid=arch] .arch-box strong', '[data-testid=arch] .chips li', '.card h3', '.card p', '.where', '.chips li', '.note', 'table th', 'table td', '.tile-value', '.tile-label',
  '[data-testid=play-tiles] strong', '[data-testid=play-notes] li', '[data-testid=gate-limits]', '[data-testid=exclusions] .chips li', '[data-testid=exclusions] summary', '#people .part', '#people p',
  '#people .pill-link', 'footer p', 'footer .about-link', 'graph-replay .row-title', 'graph-replay .node-name', 'graph-replay .legend-stage .badge',
];

async function belowMinimum(page: Page, selectors: string[]) {
  const bad: string[] = [];
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    if (count === 0) { bad.push(`${selector}: not on the page`); continue; }
    for (let i = 0; i < Math.min(count, 3); i++) {
      if (!(await page.locator(selector).nth(i).isVisible())) continue;
      const ratio = await contrastOf(page, selector, i);
      if (ratio < MIN) bad.push(`${selector}#${i}: ${ratio.toFixed(2)}`);
    }
  }
  return bad;
}

for (const scheme of ["light", "dark"] as const) {
  test(`the main page's text is at least 4.5:1 in the ${scheme} theme, every panel open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?interval=40&view=everything");
    await finishRun(page);
    await page.getByTestId("view-switch").click();           // pressed state: its colours too
    await page.getByTestId("view-switch").click();
    await page.getByTestId("legend-stage").first().click().catch(() => undefined);
    expect(await belowMinimum(page, MAIN_TEXT)).toEqual([]);
  });

  test(`How this app was built is at least 4.5:1 in the ${scheme} theme, every panel open`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/under-the-hood.html?view=everything");
    await expect(page.getByTestId("fact-steps")).not.toHaveText("not available right now");
    await page.getByTestId("exclusions").locator("summary").click();
    expect(await belowMinimum(page, BUILT_TEXT)).toEqual([]);
  });
}

test("the dark bands keep one dark look in both themes, so their text has one contrast", async ({ page }) => {
  const read = async (scheme: "light" | "dark") => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?view=everything");
    await expect(page.getByTestId("hero-title")).toBeVisible();
    return page.getByTestId("hero").evaluate((el) => getComputedStyle(el).backgroundColor);
  };
  expect(await read("light")).toBe(await read("dark"));
});
