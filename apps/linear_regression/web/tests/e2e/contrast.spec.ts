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
    await expect(page.getByTestId("fact-steps")).not.toHaveText("na");
    await page.getByTestId("exclusions").locator("summary").click();
    expect(await belowMinimum(page, BUILT_TEXT)).toEqual([]);
  });
}

// feature 024: the batter is blended over the whole run-by-over chart at 7%. Each piece of chart text is measured against the chart fill under it, with and without
// that blend at its strongest point; text that met 4.5:1 must still meet it.
for (const scheme of ["light", "dark"] as const) {
  test(`the chart's text keeps its contrast under the batter in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?view=everything");
    await expect(page.getByTestId("worm-chart").locator("svg").first()).toBeVisible();
    const rows = await page.getByTestId("worm-chart").evaluate((host) => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgba = (css: string): [number, number, number, number] => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
      const over = (t: number[], u: number[]) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3]));
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
      const stage = host.closest(".worm-stage")!, batter = getComputedStyle(stage.querySelector(".silhouette-batter")!);
      const ink = rgba(batter.backgroundColor), a = Number(batter.opacity);
      const blend = (x: number, c: number) => (batter.mixBlendMode === "screen" ? x * (1 - a) + a * (255 - ((255 - x) * (255 - c)) / 255) : x * (1 - a) + a * ((x * c) / 255));
      const through = (rgb: number[]) => [0, 1, 2].map((i) => blend(rgb[i], ink[i]));
      const card = rgba(getComputedStyle(host.closest(".worm-card")!).backgroundColor);
      const out: { text: string; before: number; after: number }[] = [];
      for (const t of host.querySelectorAll("svg text")) {
        const r = t.getBoundingClientRect();
        if (!r.width || !(t.textContent ?? "").trim()) continue;
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        // the topmost filled rect (last in drawing order) whose box holds the text's centre; no hit test, so it works off screen
        const under = [...((t as SVGTextElement).ownerSVGElement ?? host).querySelectorAll("rect")].filter((e) => {
          const f = e.getAttribute("fill"), q = e.getBoundingClientRect();
          return f && f !== "none" && cx >= q.x && cx <= q.right && cy >= q.y && cy <= q.bottom;
        }).reverse();
        let base = card.slice(0, 3);
        const fillOf = (e: Element) => { const f = rgba(getComputedStyle(e).fill); return [f[0], f[1], f[2], f[3] * Number(getComputedStyle(e).fillOpacity)]; };
        if (under.length) base = over(fillOf(under[0]), base);
        const fg = over(rgba(getComputedStyle(t).fill), base);
        out.push({ text: (t.textContent ?? "").trim().slice(0, 30), before: ratio(fg, base), after: ratio(through(fg), through(base)) });
      }
      return out;
    });
    expect(rows.length).toBeGreaterThan(5);
    const bad = rows.filter((r) => r.after < MIN);
    expect(bad, JSON.stringify(bad)).toEqual([]);
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
