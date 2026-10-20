import { expect, test, type Page } from "./fixtures";
import { contrastOf, open } from "./helpers";

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
  // the chart is a readable size and the zoom sits under the line graph, with no key and no joining lines
  expect(card.width).toBeLessThanOrEqual(360);
  await expect(page.getByTestId("worm-chart-svg")).toHaveAttribute("data-mode", "narrow");
  await expect(page.getByTestId("worm-key")).toHaveCount(0);
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

test("the chart shows the zoom's labels, the wicket circles and the 10-over score from the example innings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const ref = await reference(page);
  const e = ref.example!;
  await expect(page.getByTestId("worm-chart-svg")).toHaveAttribute("data-mode", "wide");
  await expect(page.getByTestId("worm-zoom-label")).toHaveCount(3);
  await expect(page.locator("[data-testid=worm-zoom-label][data-series=actual]")).toHaveText(`Actual ${e.final_total}`);
  await expect(page.locator("[data-testid=worm-zoom-label][data-series=tv]")).toHaveText(`TV ${e.tv_projection}`);
  await expect(page.locator("[data-testid=worm-zoom-label][data-series=nothing]")).toHaveText(`Know-nothing ${Math.round(ref.average_total!)}`);
  await expect(page.getByTestId("worm-zoom-agent")).toBeVisible();
  await expect(page.getByTestId("worm-zoom-agent-text")).toHaveText("The agent: ?");
  await expect(page.getByTestId("worm-dot-label")).toHaveText(`${e.runs_at_10}/${e.wickets_at_10}`);
  await expect(page.getByTestId("worm-zoom-key")).toHaveText(`TV's usual miss, ±${ref.figures!.broadcaster.average_miss.toFixed(1)}`);
  const shown = e.wicket_overs.filter((o) => o !== 10 && o !== 20);
  await expect(page.getByTestId("worm-wicket")).toHaveCount(shown.length);
  expect(await page.getByTestId("worm-wicket").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-over"))))).toEqual(shown);
  expect(await page.getByTestId("worm-wicket").evaluateAll((els) => els.map((el) => `${el.getAttribute("data-over")}:${el.getAttribute("data-band")}`))).toEqual(
    shown.map((o) => `${o}:${o < 10 ? "context" : "prediction"}`));
  await expect(page.getByTestId("worm-finish-actual")).toHaveCount(1);
  for (const gone of ["worm-end-label", "worm-miss-label", "worm-key"]) await expect(page.getByTestId(gone)).toHaveCount(0);
});

test("the line graph spaces the overs evenly, with the context band, the prediction area and the headings", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const ticks = await page.locator('[data-testid=worm-axis-label][data-over]').evaluateAll((els) => els.map((el) => ({ over: Number(el.getAttribute("data-over")), r: el.getBoundingClientRect() })));
  expect(ticks.map((t) => t.over)).toEqual([0, 5, 10, 15, 20]);
  // the 20-over label is right-aligned at the finish line, so compare the first four tick centres, which are evenly spaced
  const centres = ticks.slice(0, 4).map((t) => t.r.x + t.r.width / 2);
  const gaps = centres.slice(1).map((c, i) => c - centres[i]);
  for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThan(2);
  const context = await page.getByTestId("worm-context").boundingBox(), prediction = await page.getByTestId("worm-prediction").boundingBox();
  expect(Math.abs(context!.width - prediction!.width)).toBeLessThan(2);                         // overs 0 to 10 and 10 to 20 take equal widths
  await expect(page.getByTestId("worm-context-heading")).toContainText("CONTEXT");
  await expect(page.getByTestId("worm-context-heading")).toContainText("first 10 overs");
  await expect(page.getByTestId("worm-prediction-heading")).toContainText("THE PREDICTION");
  await expect(page.getByTestId("worm-prediction-heading")).toContainText("where will the last 10 overs take it?");
  await expect(page.locator('[data-testid=worm-axis-label][data-over="20"]')).toHaveText("20 overs");
  expect(await page.locator('[data-testid=worm-axis-label][data-over="20"]').evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
  // what actually happened is solid and in the text colour; the first 10 overs are grey
  const series = await page.evaluate(() => {
    const css = (id: string) => { const n = document.querySelector(`[data-testid=${id}]`)!; const c = getComputedStyle(n); return { stroke: c.stroke, op: c.strokeOpacity, dash: c.strokeDasharray }; };
    return { actual: css("worm-series-actual"), context: css("worm-series-context"), tv: css("worm-series-tv"), nothing: css("worm-series-nothing") };
  });
  expect(series.actual.op).toBe("1");
  expect(series.actual.dash).toBe("none");
  expect(series.context.stroke).not.toBe(series.actual.stroke);
  expect(series.tv.dash).not.toBe("none");
  expect(series.nothing.dash).not.toBe(series.tv.dash);                                          // dashed and dotted differ
  await expect(page.getByTestId("worm-join")).toHaveCount(2);
  await expect(page.getByTestId("worm-lens")).toHaveCount(1);
  await expect(page.getByTestId("worm-actual-label")).toHaveText("what actually happened");
});

test("at desktop width the line graph panel takes 60% of the chart and the zoom 40%", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const svg = (await page.getByTestId("worm-chart-svg").boundingBox())!;
  const line = (await page.getByTestId("worm-line").boundingBox())!;
  const zoom = (await page.getByTestId("worm-zoom").boundingBox())!;
  // the line graph's panel includes its axis labels, so measure from the svg's left edge to the finish line's panel edge
  const panelRight = svg.x + svg.width * 0.6;
  expect(Math.abs((line.x + line.width) - panelRight)).toBeLessThanOrEqual(svg.width * 0.07);   // the plot ends inside its panel, before the 60% mark
  const zoomShare = zoom.width / svg.width, lineShare = (panelRight - svg.x) / svg.width;
  expect(Math.abs(lineShare - 0.6)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(zoomShare - 0.4)).toBeLessThanOrEqual(0.02);                                  // 39%, the gap being the rest
  expect(zoom.x).toBeGreaterThanOrEqual(panelRight - 1);
  await expect(page.getByTestId("worm-line")).toBeVisible();
  await expect(page.getByTestId("worm-zoom")).toBeVisible();
});

test("the zoom's labels, the agent box and the key never overlap, whatever the values", async ({ page }) => {
  for (const [final, tv, nothing] of [[null, null, null], [186, 164, 163], [150, 171, 162], [164, 164, 164], [200, 90, 180], [40, 38, 41]] as const) {
    await page.setViewportSize({ width: 1280, height: 800 });
    if (final !== null) {
      await serveReference(page, (b) => {
        const runs = [...b.example!.runs.slice(0, 19), final];
        return { ...b, average_total: nothing, example: { ...b.example!, runs, final_total: final, tv_projection: tv, runs_at_10: Math.min(b.example!.runs_at_10, final) } };
      });
    }
    await open(page);
    const boxes = await page.locator("[data-testid=worm-zoom-label], [data-testid=worm-zoom-bracket-words], [data-testid=worm-zoom-agent], [data-testid=worm-zoom-key]")
      .evaluateAll((els) => els.map((el) => ({ id: el.getAttribute("data-testid") + ":" + (el.getAttribute("data-series") ?? ""), r: el.getBoundingClientRect().toJSON() })));
    expect(boxes.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `${boxes[i].id} and ${boxes[j].id} overlap for ${final}/${tv}/${nothing}`).toBe(false);
    }
    await page.unroute("**/api/reference");
  }
});

test("the bracket says short, over or spot on to match the displayed totals, and the caption says the same", async ({ page }) => {
  for (const [final, tv, words] of [[186, 164, "22 runs short"], [150, 171, "21 runs over"], [180, 180, "spot on"], [181, 180, "1 run short"]] as const) {
    await serveReference(page, (b) => {
      const runs = [...b.example!.runs.slice(0, 19), final];
      const miss = Math.abs(final - tv);
      const caption = `CAPTION: the TV was ${words}.`;
      return { ...b, example: { ...b.example!, runs, final_total: final, tv_projection: tv, tv_miss: miss, runs_at_10: Math.min(b.example!.runs_at_10, final) }, hero: { ...b.hero!, caption } };
    });
    await open(page);
    await expect(page.getByTestId("worm-zoom-bracket-words")).toHaveText(words);
    await expect(page.getByTestId("worm-zoom-bracket")).toHaveAttribute("data-direction", final > tv ? "short" : final < tv ? "over" : "spot on");
    await expect(page.getByTestId("worm-caption")).toContainText(words);
    await page.unroute("**/api/reference");
  }
});

test("the real caption says what the grey and white parts are, and the bracket's words are in it", async ({ page }) => {
  await open(page);
  const ref = await reference(page);
  const caption = ref.hero!.caption!;
  await expect(page.getByTestId("worm-caption")).toHaveText(caption);
  expect(caption).toContain("The first 10 overs, in grey, are context; the white part is what everyone is trying to predict.");
  expect(caption).toContain(`went from ${ref.example!.runs_at_10}/${ref.example!.wickets_at_10} to ${ref.example!.final_total}.`);
  expect(caption.endsWith("Open circles mark wickets.")).toBe(true);
  expect(caption).toContain(await page.getByTestId("worm-zoom-bracket-words").textContent() as string);
  const text = ref.hero!.chart_text!.toLowerCase();
  expect(text).toContain("zoom on the finish");
  expect(text).toContain("usual miss");
});

test("the usual-miss bar spans exactly the TV's projection plus and minus its average miss on the zoom's ruler", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const ref = await reference(page);
  const tv = ref.example!.tv_projection, miss = ref.figures!.broadcaster.average_miss;
  const bar = page.getByTestId("worm-zoom-miss");
  expect(Number(await bar.getAttribute("data-from"))).toBeCloseTo(tv - miss, 6);
  expect(Number(await bar.getAttribute("data-to"))).toBeCloseTo(tv + miss, 6);
  // pixels: the bar's height equals 2 x miss runs at the ruler's scale (ticks are 10 runs apart)
  const ticks = await page.getByTestId("worm-zoom-tick").evaluateAll((els) => els.map((el) => ({ v: Number(el.getAttribute("data-value")), y: el.getBoundingClientRect().y + el.getBoundingClientRect().height / 2 })));
  const perRun = Math.abs(ticks[0].y - ticks[ticks.length - 1].y) / Math.abs(ticks[ticks.length - 1].v - ticks[0].v);
  const rect = (await bar.boundingBox())!;
  expect(Math.abs(rect.height - 2 * miss * perRun)).toBeLessThanOrEqual(3);
});

test("with the TV and the know-nothing guess within 2 runs and with the TV above the total, the chart still reads", async ({ page }) => {
  for (const [final, tv, nothing] of [[186, 164, 163], [150, 171, 162]] as const) {
    await serveReference(page, (b) => ({ ...b, average_total: nothing, example: { ...b.example!, runs: [...b.example!.runs.slice(0, 19), final], final_total: final, tv_projection: tv, tv_miss: Math.abs(final - tv) } }));
    await open(page);
    for (const id of ["worm-zoom-label", "worm-zoom-bracket-words", "worm-zoom-agent", "worm-zoom-key"]) await expect(page.getByTestId(id).first()).toBeVisible();
    const inside = await page.evaluate(() => {
      const card = (document.querySelector("[data-testid=worm-zoom] rect") as SVGRectElement).getBoundingClientRect();
      return [...document.querySelectorAll("[data-testid=worm-zoom-label], [data-testid=worm-zoom-bracket-words], [data-testid=worm-zoom-agent]")]
        .every((el) => { const r = el.getBoundingClientRect(); return r.x >= card.x - 1 && r.x + r.width <= card.x + card.width + 1 && r.y >= card.y - 1 && r.y + r.height <= card.y + card.height + 1; });
    });
    expect(inside).toBe(true);
    await page.unroute("**/api/reference");
  }
});

test("at 360 px the zoom sits under the line graph at full width and nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  const line = (await page.getByTestId("worm-chart-svg").boundingBox())!, zoom = (await page.getByTestId("worm-zoom-svg").boundingBox())!;
  expect(zoom.y).toBeGreaterThanOrEqual(line.y + line.height - 1);
  expect(Math.abs(zoom.width - line.width)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByTestId("worm-join")).toHaveCount(0);
  await expect(page.getByTestId("worm-key")).toHaveCount(0);
  await expect(page.getByTestId("worm-lens")).toHaveCount(1);
  for (const id of ["worm-zoom-label", "worm-zoom-agent", "worm-zoom-key"]) await expect(page.getByTestId(id).first()).toBeVisible();
});

test("the layout follows the card's width: side by side from 560 px, stacked below", async ({ page }) => {
  for (const [width, mode, svgs] of [[1280, "wide", 1], [600, "wide", 1], [500, "narrow", 2], [360, "narrow", 2]] as const) {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await expect(page.getByTestId("worm-chart-svg")).toHaveAttribute("data-mode", mode);
    expect(await page.getByTestId("worm-card").locator("svg").count()).toBe(svgs);
  }
});

test("the title and the header copy run the full width, and the title fits on one line at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const m = await page.evaluate(() => {
    const title = document.querySelector("[data-testid=hero-title]") as HTMLElement;
    const lead = document.querySelector(".hero-lead") as HTMLElement;
    const head = document.querySelector(".hero-head") as HTMLElement;
    const grid = document.querySelector(".hero-grid") as HTMLElement;
    const range = document.createRange(); range.selectNodeContents(title);
    const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    const cs = getComputedStyle(title);
    return { lines, titleW: title.getBoundingClientRect().width, leadW: lead.getBoundingClientRect().width, headW: head.getBoundingClientRect().width, gridW: grid.getBoundingClientRect().width,
      titleMax: cs.maxWidth, leadMax: getComputedStyle(lead).maxWidth, headMax: getComputedStyle(head).maxWidth, wrap: getComputedStyle(title).getPropertyValue("text-wrap") };
  });
  expect(m.lines).toBe(1);
  expect([m.titleMax, m.leadMax, m.headMax]).toEqual(["none", "none", "none"]);
  expect(m.wrap).not.toBe("balance");
  expect(Math.abs(m.titleW - m.headW)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.leadW - m.headW)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.headW - m.gridW)).toBeLessThanOrEqual(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the chart's text keeps 4.5:1 contrast in the ${scheme} theme, and the context line 3:1 on its band`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    const checks: [string, string][] = [
      ["actual label", "[data-testid=worm-zoom-label][data-series=actual]"], ["tv label", "[data-testid=worm-zoom-label][data-series=tv]"],
      ["know-nothing label", "[data-testid=worm-zoom-label][data-series=nothing]"], ["bracket words", "[data-testid=worm-zoom-bracket-words]"],
      ["key", "[data-testid=worm-zoom-key]"], ["zoom title", "[data-testid=worm-zoom-title]"], ["zoom subtitle", "[data-testid=worm-zoom-title-2]"],
      ["zoom tick", "[data-testid=worm-zoom-tick]"], ["agent text", "[data-testid=worm-zoom-agent-text]"],
      ["context heading", "[data-testid=worm-context-heading]"], ["prediction heading", "[data-testid=worm-prediction-heading]"],
      ["axis label", "[data-testid=worm-axis-label]"], ["actual note", "[data-testid=worm-actual-label]"], ["dot label", "[data-testid=worm-dot-label]"],
    ];
    for (const [name, sel] of checks) {
      // an SVG text's fill is its text colour; read it through the element's computed fill, over the element's backdrop
      const ratio = await page.locator(sel).first().evaluate((el) => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const rgb = (css: string): [number, number, number, number] => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
        const lum = (c: number[]) => { const [r, g, b] = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const rect = el.getBoundingClientRect();
        // the backdrop: the filled SVG shape (or the card) under the middle of the text, else the page
        const hits = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          .filter((n) => n !== el && !n.closest("text") && (!(n instanceof SVGElement) || ["rect", "circle", "path", "polygon"].includes(n.tagName.toLowerCase())));
        let back: [number, number, number, number] = rgb(getComputedStyle(document.body).backgroundColor);
        for (const n of hits) { const f = n instanceof SVGElement ? getComputedStyle(n).fill : getComputedStyle(n).backgroundColor; const c = rgb(f); if (c[3] > 0.9) { back = c; break; } }
        const fg = rgb(getComputedStyle(el).fill || getComputedStyle(el).color);
        const [hi, lo] = [lum(fg), lum(back)].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(ratio, `${scheme}: ${name}`).toBeGreaterThanOrEqual(4.5);
    }
    // the context line against its band (3:1)
    const line = await page.evaluate(() => {
      const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgb = (c: string) => { ctx.fillStyle = "#000"; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]; };
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const [hi, lo] = [lum(rgb(css("--context-line"))), lum(rgb(css("--context-band")))].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(line, `${scheme}: the context line on its band`).toBeGreaterThanOrEqual(3);
  });
}

test("nothing in the chart is animated, and the series are told apart by more than colour", async ({ page }) => {
  await open(page);
  expect(await page.getByTestId("worm-card").evaluate((el) => (el as HTMLElement).getAnimations({ subtree: true }).length)).toBe(0);
  const durations = await page.getByTestId("worm-card").locator("*").evaluateAll((els) => els.map((el) => getComputedStyle(el).transitionDuration + "|" + getComputedStyle(el).animationName));
  for (const d of durations) expect(/^(0s)(, 0s)*\|none$/.test(d) || ["|none", "0s|", ""].includes(d)).toBe(true);
  // three predictions, three marker shapes, each with its name
  const tags = await page.getByTestId("worm-zoom-marker").evaluateAll((els) => els.map((el) => `${el.getAttribute("data-series")}:${el.tagName}:${el.getAttribute("transform") ? "rotated" : "plain"}:${getComputedStyle(el).fill === "none" ? "open" : "filled"}`));
  expect(new Set(tags).size).toBe(3);
  await expect(page.locator("[data-testid=worm-zoom-label]")).toHaveCount(3);
});

// ---------------- every number comes from the server ----------------

const NUMBER = /\d(?:[\d,]*\d)?(?:\.\d+)?/g;
// numbers that are part of the page's fixed wording or the chart's fixed axes, not figures
const FIXED = ["10", "20", "1", "2", "3", "0", "5", "15", "50", "100", "150", "200", "250", "300", "350", "400"];

/** The zoom ruler's ticks, worked out here from the server's figures (an independent copy of the rule: the nearest 10 below the lowest and above the highest of the three totals and TV +/- the average miss, with 2 runs of room). */
function zoomTicks(ref: Reference): string[] {
  const e = ref.example!, miss = ref.figures!.broadcaster.average_miss, nothing = Math.round(ref.average_total!);
  const all = [e.final_total, e.tv_projection, nothing, e.tv_projection - miss, e.tv_projection + miss];
  const lo = Math.floor((Math.min(...all) - 2) / 10) * 10;
  let hi = Math.ceil((Math.max(...all) + 2) / 10) * 10;
  if (hi - lo < 10) hi = lo + 10;
  const out: string[] = [];
  for (let t = lo; t <= hi; t += 10) out.push(String(t));
  return out;
}

function expectedNumbers(ref: Reference): { required: string[]; allowed: Set<string> } {
  const e = ref.example!, f = ref.figures!;
  const required = [
    f.broadcaster.average_miss.toFixed(1), f.know_nothing.average_miss.toFixed(1), Math.abs(f.broadcaster.bias).toFixed(1),
    String(ref.goal.margin_runs), ref.training!.innings.toLocaleString("en-US"), String(ref.training!.first_year),
    String(ref.training!.last_year), String(Math.round(ref.average_total!)), String(e.runs_at_10), String(e.wickets_at_10),
    String(e.final_total), String(e.tv_projection), String(e.tv_miss),
    String(e.date_label.split(" ")[1]), String(Math.abs(e.final_total - e.tv_projection)),
  ];
  return { required, allowed: new Set([...required, ...FIXED, ...zoomTicks(ref)]) };
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
  await expect(page.locator("[data-testid=worm-zoom-label][data-series=tv]")).toHaveText("TV 150");
  await expect(page.locator("[data-testid=worm-zoom-label][data-series=nothing]")).toHaveText("Know-nothing 171");
  await expect(page.getByTestId("worm-zoom-key")).toHaveText("TV's usual miss, ±12.8");
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
