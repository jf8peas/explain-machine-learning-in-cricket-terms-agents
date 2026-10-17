import { expect, test, type Page } from "./fixtures";
import { open } from "./helpers";

// The Working tab's hero (feature 013): the breadcrumb, headline, worm chart, "How good is the TV projection?" panel and
// the three steps. Every number on it is compared with what /api/reference sent, never with a number typed in here.

interface Figures { average_miss: number; bias: number }
interface Example {
  match_id: string; batting_team: string; bowling_team: string; venue: string; date_label: string;
  runs: number[]; wickets: number[]; runs_at_10: number; wickets_at_10: number; final_total: number;
  tv_projection: number; tv_miss: number; wicket_overs: number[];
}
interface Reference {
  goal: { margin_runs: number };
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: { know_nothing: Figures; broadcaster: Figures } | null;
  average_total: number | null;
  example: Example | null;
  hero: { caption: string | null; panel: string; panel_emphasis: string[]; footnote: string; chart_text: string | null } | null;
  message: string | null;
}

const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json()) as Reference;
const hero = (page: Page) => page.getByTestId("hero");

/** Answer /api/reference with the real response changed by `change`. */
async function serveReference(page: Page, change: (body: Reference) => Reference) {
  const real = await reference(page);
  await page.route("**/api/reference", (route) => route.fulfill({ json: change(structuredClone(real)) }));
}

const box = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!;

// ---------------- order and layout ----------------

test("the hero reads in order: breadcrumb above the tab bar, then headline, chart, panel and steps", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("worm-chart-svg")).toBeVisible();
  const crumb = await box(page, "breadcrumb"), tabs = await box(page, "tab-working");
  expect(crumb.y + crumb.height).toBeLessThanOrEqual(tabs.y + 1);
  const order = await page.evaluate(() => {
    const ids = ["breadcrumb", "tab-working", "hero-title", "worm-card", "tv-panel", "hero-steps", "model-picker"];
    const nodes = ids.map((id) => document.querySelector(`[data-testid="${id}"]`) ?? document.querySelector("tab-set")!.shadowRoot?.querySelector(`[data-testid="${id}"]`));
    return nodes.every((n, i) => i === 0 || !n || !nodes[i - 1] || !!(nodes[i - 1]!.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(order).toBe(true);
  await expect(page.getByTestId("breadcrumb").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("breadcrumb")).toContainText("Linear regression");
});

test("the breadcrumb links to the main site and stays above the tab bar on every tab", async ({ page }) => {
  await open(page);
  const link = page.getByTestId("breadcrumb").getByRole("link", { name: "Explain Machine Learning in Cricket Terms" });
  expect(await link.getAttribute("href")).toBeTruthy();
  expect(await link.getAttribute("href")).not.toContain("%VITE_SITE_URL%");
  for (const id of ["data", "found", "final-test", "try-your-own"]) {
    await page.getByTestId(`tab-${id}`).click();
    await expect(page.getByTestId("breadcrumb")).toBeVisible();
  }
});

test("the headline, lead and the experiment are stated in words, with no buttons or links to Play or the Data tab", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("hero-title")).toHaveText("Halfway through a T20 innings. Where will it finish?");
  await expect(hero(page)).toContainText("An AI agent experiment · linear regression");
  await expect(hero(page)).toContainText("An AI agent learns from past innings to predict the final total from the score after 10 overs. Can it beat the TV's projection?");
  await expect(page.getByTestId("hero-steps").locator("li")).toHaveCount(3);
  await expect(hero(page).locator("button, a[href], [role=button], [role=link]")).toHaveCount(0);
  await expect(hero(page)).not.toContainText(/press play|go to the data/i);
});

test("at 1280 by 800 the top of the model picker is in view below the hero without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await expect(page.getByTestId("worm-chart-svg")).toBeVisible();
  const picker = await box(page, "model-picker"), heroBox = await box(page, "hero");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(picker.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 1);          // below the hero
  expect(picker.y + 24).toBeLessThanOrEqual(800);                                   // and its top is visible
});

test("at phone width the hero is one column in order and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await expect(page.getByTestId("worm-chart-svg")).toBeVisible();
  const [title, card, panel, steps] = await Promise.all(["hero-title", "worm-card", "tv-panel", "hero-steps"].map((id) => box(page, id)));
  expect(title.y).toBeLessThan(card.y);
  expect(card.y + card.height).toBeLessThanOrEqual(panel.y + 1);
  expect(panel.y + panel.height).toBeLessThanOrEqual(steps.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // the chart is a readable size and its end labels are in a key under it, not shrunk to nothing beside it
  await expect(page.getByTestId("worm-key")).toBeVisible();
  expect(card.width).toBeLessThanOrEqual(360);
  expect(Number(await page.getByTestId("worm-chart-svg").getAttribute("data-mode") === "key")).toBe(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the hero renders in ${scheme} mode with readable text`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(page.getByTestId("worm-chart-svg")).toBeVisible();
    const colours = await page.evaluate(() => {
      const css = (el: Element, p: string) => getComputedStyle(el).getPropertyValue(p).trim();
      const root = document.documentElement;
      return { bg: css(document.body, "background-color"), text: css(document.querySelector("[data-testid=hero-title]")!, "color"),
        tv: css(root, "--tv"), tvFigure: css(document.querySelector("[data-testid=tv-miss]")!, "color") };
    });
    expect(colours.bg).not.toBe(colours.text);
    expect(colours.tv).toBe(scheme === "dark" ? "#e8913a" : "#a85600");
    expect(colours.tvFigure).not.toBe(colours.bg);
    await expect(page.getByTestId("tv-miss")).toBeVisible();
    await expect(page.getByTestId("worm-caption")).toBeVisible();
  });
}

// ---------------- the chart ----------------

test("the chart has a text equivalent: the server's sentence is its accessible label", async ({ page }) => {
  await open(page);
  const ref = await reference(page);
  const svg = page.getByTestId("worm-chart-svg");
  await expect(svg).toHaveAttribute("role", "img");
  await expect(svg).toHaveAttribute("aria-label", ref.hero!.chart_text!);
  const label = ref.hero!.chart_text!;
  const e = ref.example!;
  for (const part of [e.batting_team, e.bowling_team, `${e.runs_at_10} for ${e.wickets_at_10}`, String(e.tv_projection),
    String(ref.average_total), String(e.final_total), "agent's prediction is not known"]) expect(label).toContain(part);
});

test("the chart shows the end labels, the wicket circles and the 10-over score from the example innings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const ref = await reference(page);
  const e = ref.example!;
  await expect(page.getByTestId("worm-chart-svg")).toHaveAttribute("data-mode", "side");
  const labels = page.getByTestId("worm-end-label");
  await expect(labels).toHaveCount(4);
  await expect(page.locator('[data-testid=worm-end-label][data-series=actual]')).toHaveText(`Actual ${e.final_total}`);
  await expect(page.locator('[data-testid=worm-end-label][data-series=tv]')).toHaveText(`TV projection ${e.tv_projection}`);
  await expect(page.locator('[data-testid=worm-end-label][data-series=nothing]')).toHaveText(`Know-nothing ${ref.average_total}`);
  await expect(page.locator('[data-testid=worm-end-label][data-series=agent]')).toHaveText("The agent: ?");
  await expect(page.getByTestId("worm-dot-label")).toHaveText(`${e.runs_at_10}/${e.wickets_at_10}`);
  await expect(page.getByTestId("worm-miss-label")).toContainText(`±${ref.figures!.broadcaster.average_miss.toFixed(1)} runs`);
  const shown = e.wicket_overs.filter((o) => o !== 10 && o !== 20);
  await expect(page.getByTestId("worm-wicket")).toHaveCount(shown.length);
  expect(await page.getByTestId("worm-wicket").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-over"))))).toEqual(shown);
  await expect(page.getByTestId("worm-final")).toHaveCount(1);
});

test("the end labels never overlap, whatever the values", async ({ page }) => {
  for (const [final, tv, nothing] of [[null, null, null], [164, 164, 164], [200, 90, 180], [40, 38, 41]] as const) {
    await page.setViewportSize({ width: 1280, height: 800 });
    if (final !== null) {
      await serveReference(page, (b) => {
        const runs = [...b.example!.runs.slice(0, 19), final];
        return { ...b, average_total: nothing, example: { ...b.example!, runs, final_total: final, tv_projection: tv, runs_at_10: Math.min(b.example!.runs_at_10, final) } };
      });
    }
    await open(page);
    const boxes = await page.getByTestId("worm-end-label").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `labels ${i} and ${j} overlap for ${final}/${tv}/${nothing}`).toBe(false);
    }
    await page.unroute("**/api/reference");
  }
});

// ---------------- every number comes from the server ----------------

const NUMBER = /\d(?:[\d,]*\d)?(?:\.\d+)?/g;
// numbers that are part of the page's fixed wording or the chart's fixed axes, not figures
const FIXED = ["10", "20", "1", "2", "3", "0", "5", "15", "50", "100", "150", "200", "250", "300", "350", "400"];

function expectedNumbers(ref: Reference): { required: string[]; allowed: Set<string> } {
  const e = ref.example!, f = ref.figures!;
  const required = [
    f.broadcaster.average_miss.toFixed(1), f.know_nothing.average_miss.toFixed(1), Math.abs(f.broadcaster.bias).toFixed(1),
    String(ref.goal.margin_runs), ref.training!.innings.toLocaleString("en-US"), String(ref.training!.first_year),
    String(ref.training!.last_year), String(ref.average_total), String(e.runs_at_10), String(e.wickets_at_10),
    String(e.final_total), String(e.tv_projection), String(e.tv_miss), String(e.final_total - e.runs_at_10),
    String(e.date_label.split(" ")[1]),
  ];
  return { required, allowed: new Set([...required, ...FIXED]) };
}

test("every number in the hero equals the server's figures or the prepared data", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const ref = await reference(page);
  const { required, allowed } = expectedNumbers(ref);
  // every text node on its own (the chart's labels are separate SVG texts that sit side by side)
  const text = (await hero(page).evaluate((el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? "");
    return parts.join(" ");
  })).replace(/\s+/g, " ");
  const found = new Set(text.match(NUMBER) ?? []);
  for (const n of required) expect(found, `the hero shows ${n}`).toContain(n);
  for (const n of found) expect(allowed, `${n} in the hero is not one of the server's numbers`).toContain(n);
  // and the sentences are the server's, shown as sent
  await expect(page.getByTestId("tv-sentence")).toHaveText(ref.hero!.panel);
  await expect(page.getByTestId("tv-footnote")).toHaveText(ref.hero!.footnote);
  await expect(page.getByTestId("worm-caption")).toHaveText(ref.hero!.caption!);
  await expect(page.getByTestId("tv-miss")).toHaveText(ref.figures!.broadcaster.average_miss.toFixed(1));
  await expect(page.getByTestId("nothing-miss")).toHaveText(ref.figures!.know_nothing.average_miss.toFixed(1));
  for (const phrase of ref.hero!.panel_emphasis) await expect(page.getByTestId("tv-sentence").locator("strong")).toHaveText(phrase);
});

test("when the server's figures change, the numbers and sentences on the page change with them", async ({ page }) => {
  await serveReference(page, (b) => ({
    ...b, average_total: 171,
    figures: { know_nothing: { ...b.figures!.know_nothing, average_miss: 31.4 }, broadcaster: { ...b.figures!.broadcaster, average_miss: 12.8, bias: 7.3 } },
    example: { ...b.example!, tv_projection: 150, tv_miss: 11 },
    hero: { ...b.hero!, panel: "PANEL TEXT from the server, too high.", panel_emphasis: ["too high"], caption: "CAPTION from the server.", footnote: "FOOTNOTE from the server.",
      chart_text: "CHART TEXT from the server." },
  }));
  await open(page);
  await expect(page.getByTestId("tv-miss")).toHaveText("12.8");
  await expect(page.getByTestId("nothing-miss")).toHaveText("31.4");
  await expect(page.getByTestId("tv-sentence")).toHaveText("PANEL TEXT from the server, too high.");
  await expect(page.getByTestId("tv-sentence").locator("strong")).toHaveText("too high");
  await expect(page.getByTestId("worm-caption")).toHaveText("CAPTION from the server.");
  await expect(page.getByTestId("tv-footnote")).toHaveText("FOOTNOTE from the server.");
  await expect(page.getByTestId("worm-chart-svg")).toHaveAttribute("aria-label", "CHART TEXT from the server.");
  await expect(page.locator('[data-testid=worm-end-label][data-series=tv]')).toHaveText("TV projection 150");
  await expect(page.locator('[data-testid=worm-end-label][data-series=nothing]')).toHaveText("Know-nothing 171");
  await expect(page.getByTestId("worm-miss-label")).toContainText("±12.8 runs");
});

// ---------------- when the figures are missing ----------------

test("if the request fails the hero says so plainly, shows no numbers, and the rest of the page works", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await open(page);
  await expect(page.getByTestId("hero-unavailable")).toContainText("could not be loaded");
  await expect(page.getByTestId("tv-panel")).toBeHidden();
  await expect(page.getByTestId("worm-card")).toBeHidden();
  expect((await hero(page).locator("[data-testid=hero-title], .hero-lead, [data-testid=hero-steps]").evaluateAll((els) => els.length))).toBe(3);
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await expect(page.getByTestId("play")).toBeEnabled();
  await expect(page.getByTestId("model-picker")).toBeVisible();
});

test("with the figures null the hero shows the unavailable state and no numbers", async ({ page }) => {
  await serveReference(page, (b) => ({ ...b, training: null, figures: null, average_total: null, example: null, hero: null,
    message: "The accuracy figures could not be loaded." }));
  await open(page);
  await expect(page.getByTestId("hero-unavailable")).toContainText("could not be loaded");
  await expect(page.getByTestId("tv-panel")).toBeHidden();
  await expect(page.getByTestId("worm-card")).toBeHidden();
  await expect(page.getByTestId("hero-steps")).toBeVisible();
});

test("with no example innings the chart card is left out, no numbers are shown for it, and the panel stays", async ({ page }) => {
  await serveReference(page, (b) => ({ ...b, example: null, hero: { ...b.hero!, caption: null, chart_text: null } }));
  await open(page);
  await expect(page.getByTestId("worm-card")).toBeHidden();
  await expect(page.getByTestId("worm-chart-svg")).toHaveCount(0);
  await expect(page.getByTestId("tv-panel")).toBeVisible();
  await expect(page.getByTestId("tv-sentence")).not.toBeEmpty();
  await expect(page.getByTestId("hero-unavailable")).toBeHidden();
});

// ---------------- the old introduction is gone, the rest is unchanged ----------------

test("none of the removed introduction is on the Working tab", async ({ page }) => {
  await open(page);
  for (const id of ["intro", "intro-lead", "meter", "meter-figure", "chips", "intro-full", "reference-details", "reference-detail", "catalogue", "intro-population", "goal"]) {
    await expect(page.getByTestId(id), id).toHaveCount(0);
  }
  const working = page.getByTestId("working-panel");
  for (const text of ["How this works, in full", "Full figures for the two simple guesses", "What the agent can choose from",
    "Can an agent beat the TV projected score?", "App 1 of 8"]) await expect(working).not.toContainText(text);
});

test("the model picker with its note, the graph and the summary line are still there, under the hero", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("model-picker")).toBeVisible();
  await expect(page.getByTestId("variation-note")).toContainText("runs can differ each time");
  await expect(page.locator("graph-replay")).toBeVisible();
  await expect(page.getByTestId("run-summary")).toBeAttached();
  const picker = await box(page, "model-picker"), note = await box(page, "variation-note"), heroBox = await box(page, "hero");
  expect(picker.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 1);
  expect(note.y).toBeGreaterThanOrEqual(picker.y);
});
