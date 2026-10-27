import { expect, test, type Page } from "./fixtures";

// The "How this app was built" page (features 018, 019 and 020). Figures on the page are compared with what the app serves, never
// with numbers typed in here. The header, the switch and the Commentary panels are the main page's.

const ISSUES = "https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues";
const FEEDBACK_NAME = "Feedback (opens the GitHub issues page in a new tab)";
const AUTHOR_URL = "https://www.linkedin.com/in/john-fong-04b7a120/";
const TESTER_URL = "https://www.linkedin.com/in/alesja-tanabe-3207931b1";
const AUTHOR_LINK = "View LinkedIn profile for John Fong (opens in a new tab)";
const TESTER_LINK = "View LinkedIn profile for Alesja Tanabe (opens in a new tab)";
const SECTIONS = ["hero", "big-picture", "data", "play", "agent", "what-you-see", "shipping", "people"] as const;
const PLACEHOLDER = "na";
const GROUP_PLACEHOLDER = "These figures are not available right now.";

const figure = (page: Page, key: string) => page.locator(`[data-figure="${key}"]`).first();
const gotoPage = async (page: Page, query = "") => {
  await page.goto(`/under-the-hood.html${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "The AI agent chooses. Code does every number." })).toBeVisible();
};

// ---------------- the header ----------------

test("the header matches the main page's: the switch, Back to the app and Feedback, with the same names", async ({ page }) => {
  await gotoPage(page);
  const sw = page.getByTestId("view-switch");
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await expect(sw).toHaveText("Show me everything");
  await expect(page.getByTestId("back-top")).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Back to the app", exact: true }).first()).toBeVisible();
  const top = page.getByTestId("link-feedback");
  await expect(top).toHaveAttribute("href", ISSUES);
  await expect(top).toHaveAttribute("target", "_blank");
  await expect(top).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("link", { name: FEEDBACK_NAME, exact: true })).toHaveCount(1);
  expect((await sw.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("the switch opens every Commentary panel, is remembered, and carries from the main page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("view-switch").click();
  await page.getByTestId("link-under-the-hood").click();
  await expect(page).toHaveURL(/under-the-hood\.html$/);
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "true");
  const panels = page.locator(".commentary");
  expect(await panels.count()).toBeGreaterThanOrEqual(5);
  for (const p of await panels.all()) await expect(p).toBeVisible();
  await page.getByTestId("view-switch").click();
  await page.getByTestId("back-top").click();
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "false");
});

test("?view=everything opens the detailed view here too", async ({ page }) => {
  await gotoPage(page, "?view=everything");
  await expect(page.getByTestId("commentary-data")).toBeVisible();
});

test("the main page's link reads How it was built, and Back to the app returns", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("link-under-the-hood")).toHaveAccessibleName("How it was built");
  await page.getByTestId("link-under-the-hood").click();
  await expect(page).toHaveURL(/\/under-the-hood\.html$/);
  await page.getByTestId("back-top").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("hero-title")).toBeVisible();
});

// ---------------- the hero and the parts ----------------

test("the hero has its kicker, headline, lead and four counted facts", async ({ page }) => {
  await gotoPage(page);
  await expect(page.locator("#hero .kicker")).toHaveText("HOW THIS APP WAS BUILT");
  await expect(page.locator("#hero .hero-lead")).toHaveText(
    "A LangGraph agent runs in a Python function on Vercel. The data is real ball-by-ball cricket from Cricsheet.");
  const structure = await (await page.request.get("/api/structure")).json();
  const steps = structure.nodes.filter((n: { kind: string }) => n.kind === "node");
  await expect(page.getByTestId("fact-steps")).toHaveText(String(steps.length));
  await expect(page.getByTestId("fact-llm-steps")).toHaveText(String(steps.filter((n: { actor: string }) => n.actor === "llm").length));
  const catalogue = await (await page.request.get("/api/catalogue")).json();
  await expect(page.getByTestId("fact-clues")).toHaveText(String(catalogue.features.length));
  const summary = (await (await page.request.get("/api/data")).json()).summary;
  await expect(page.getByTestId("fact-innings")).toHaveText(summary.headline.find((r: { label: string }) => r.label === "Innings").value);
});

test("the jump links point at the sections and move the page there", async ({ page }) => {
  await gotoPage(page);
  const links = page.getByTestId("jump-links").getByRole("link");
  await expect(links).toHaveText(["Big picture", "1 · Data", "2 · Running it live", "3 · The agent", "4 · What you see", "5 · Shipping", "Who built this"]);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs).toEqual(["#big-picture", "#data", "#play", "#agent", "#what-you-see", "#shipping", "#people"]);
  for (const id of ["data", "agent", "people"]) {
    await page.getByTestId("jump-links").locator(`a[href="#${id}"]`).click();
    await expect.poll(async () => (await page.locator(`#${id}`).boundingBox())!.y).toBeLessThan(200);
  }
});

test("every part has a heading and a visual, with its Commentary closed until asked for", async ({ page }) => {
  await gotoPage(page);
  for (const id of SECTIONS) await expect(page.locator(`section#${id}`)).toBeVisible();
  for (const id of ["commentary-big", "commentary-data", "commentary-play", "commentary-agent", "commentary-see"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(page.locator("#h-big")).toHaveText("Three parts, two helpers.");
  await expect(page.getByTestId("arch")).toContainText("A Python function on Vercel");
  await expect(page.getByTestId("arch")).toContainText("OpenRouter · language model");
  await expect(page.getByTestId("arch")).toContainText("Upstash Redis · run limits");
  const catalogue = await (await page.request.get("/api/catalogue")).json();
  await expect(page.locator("#h-data")).toHaveText(`Every innings becomes one row of ${catalogue.features.length} possible clues.`);
  await expect(page.getByTestId("data-tiles").locator("li")).toHaveCount(3);
  await expect(page.locator("#h-play")).toHaveText("Only a live run runs the agent. Each step streams back.");
  await expect(page.getByTestId("play-tiles").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("play-tiles").locator("li strong")).toHaveText(["Vercel", "FastAPI", "The gate", "The agent", "The stream"]);
  await expect(page.locator("#h-see")).toHaveText("Your browser keeps every step, so you can pause and rewind.");
  await expect(page.getByTestId("levels").locator("h3")).toHaveText(["Scoreboard", "Commentary", "Scorebook"]);
  await expect(page.locator("#h-ship")).toHaveText("One folder, one Vercel project, app 1 of 8.");
  await expect(page.locator("#shipping .card h3")).toHaveText(["The code", "Deployment", "The bigger site"]);
});

test("Part 3 uses the same four-row graph and stage legend as the main page, with no run controls", async ({ page }) => {
  await gotoPage(page);
  const structure = await (await page.request.get("/api/structure")).json();
  const steps = structure.nodes.filter((n: { kind: string }) => n.kind === "node").length;
  await expect(page.locator("#h-agent")).toHaveText(new RegExp(`^\\S+ steps, each tagged with one of the eight stages of any ML project\\.$`));
  await expect(page.locator("graph-replay [data-testid=graph-row]")).toHaveCount(structure.rows.length);
  await expect(page.locator("graph-replay [data-node]")).toHaveCount(steps);
  await expect(page.locator("graph-replay [data-testid=legend-stage]")).toHaveCount(structure.stages.length);
  await expect(page.locator("graph-replay").getByTestId("play")).toBeHidden();
  await expect(page.locator("graph-replay").getByTestId("pause")).toBeHidden();
  await expect(page.locator("graph-replay .node.active")).toHaveCount(0);
});

test("the agent's Commentary has one card for each stage (1, 2, 3, 4, 5–6, 7, 8), short", async ({ page }) => {
  await gotoPage(page, "?view=everything");
  const cards = page.getByTestId("stage-cards").locator(".card");
  await expect(cards).toHaveCount(7);
  const heads = await cards.locator("h3").allTextContents();
  expect(heads.map((h) => h.split(" ·")[0])).toEqual(["1", "2", "3", "4", "5–6", "7", "8"]);
  for (const c of await cards.all()) expect(((await c.locator("p").first().innerText()).match(/\S+/g) ?? []).length).toBeLessThanOrEqual(80);
});

test("the old question section and the stage-by-stage accordion are gone", async ({ page }) => {
  await gotoPage(page, "?view=everything");
  await expect(page.locator("section#question")).toHaveCount(0);
  await expect(page.getByTestId("toggle-all")).toHaveCount(0);
  await expect(page.locator(".stage-head")).toHaveCount(0);
});

test("the API calls table scrolls inside its own box on a phone, and the gate's limits are the server's", async ({ page }) => {
  await gotoPage(page, "?view=everything");
  const { run } = await (await page.request.get("/api/models")).json();
  await expect(page.getByTestId("gate-limits")).toContainText(`${run.per_hour} an hour per visitor`);
  await expect(page.getByTestId("gate-limits")).toContainText(`${run.per_day} a day for the site`);
  await expect(page.getByTestId("gate-limits")).toContainText(`up to ${run.deadline_seconds} seconds`);
  await expect(page.getByTestId("calls-table")).toContainText("/api/run?model=");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByTestId("calls-scroll").evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
});

// ---------------- Who built this (feature 019), unchanged ----------------

test("Who built this is the last section, with the author, the tester card and the design copy", async ({ page }) => {
  await gotoPage(page);
  const people = page.locator("section#people");
  await expect(people.locator("> p.part")).toHaveText("Who built this");
  await expect(people.locator("> h2")).toHaveText("John Fong");
  await expect(people.locator("> p").nth(1)).toHaveText("John Fong is an on-the-tools business analyst who builds full-stack data products end to end. This app is a personal project exploring how a LangGraph agent can work through a machine-learning problem the way a person would, and explain what it did in cricket terms.");
  const card = people.locator(".testers > .card");
  await expect(card).toHaveCount(1);
  await expect(card.locator("p.tester-kicker")).toHaveText("Who's testing it");
  await expect(card.locator("h3")).toHaveText("Alesja Tanabe");
  await expect(card.locator("p.muted")).toHaveText("Alesja Tanabe is a Senior QA Engineer in Playtech's Videobet unit with nearly 5 years of experience in gaming software quality. She specializes in black-box testing for physical gaming machines, evaluating platform reliability, edge cases, and overall player experience on Playtech's proprietary gaming platform.");
  expect(await page.locator("main > section").last().getAttribute("id")).toBe("people");
  await expect(page.locator("img, picture, video")).toHaveCount(0);
});

test("the footer credits the author and tester above the Cricsheet attribution, and ends with the feedback line", async ({ page }) => {
  await gotoPage(page);
  const paras = page.locator("footer#footer > p");
  await expect(paras.nth(0)).toHaveText("Built by John Fong · Tested by Alesja Tanabe");
  await expect(paras.nth(1)).toContainText("Cricsheet");
  const foot = page.getByTestId("link-feedback-footer");
  await expect(foot).toContainText("Questions or ideas? Leave feedback");
  await expect(foot).toHaveAttribute("href", ISSUES);
  await expect(foot).toHaveAttribute("target", "_blank");
  await expect(foot).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("link", { name: /Questions or ideas\? Leave feedback.*new tab/ })).toHaveCount(1);
  await page.getByTestId("back-footer").click();
  await expect(page).toHaveURL(/\/$/);
});

test("both LinkedIn links open a new tab, are named for their owner and are not stretched", async ({ page }) => {
  await gotoPage(page);
  const section = page.locator("section#people");
  const sectionWidth = (await section.boundingBox())!.width;
  for (const [id, url, name] of [["link-linkedin-author", AUTHOR_URL, AUTHOR_LINK], ["link-linkedin-tester", TESTER_URL, TESTER_LINK]] as const) {
    const link = page.getByTestId(id);
    await expect(link).toHaveAttribute("href", url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toContainText("View LinkedIn profile");
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(1);
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    expect(box.width).toBeLessThan(sectionWidth / 2);
    await link.focus();
    expect(parseFloat(await link.evaluate((el) => getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
  }
});

// ---------------- the live figures ----------------

interface Row { label: string; value: string }
interface Summary { headline: Row[]; sections: { title: string; rows: Row[] }[] }
const served = async (page: Page) => ({
  summary: ((await (await page.request.get("/api/data")).json()) as { summary: Summary }).summary,
  reference: (await (await page.request.get("/api/reference")).json()) as {
    training: { first_year: number; last_year: number; innings: number };
    figures: { know_nothing: { average_miss: number }; broadcaster: { average_miss: number; bias: number } };
    goal: { margin_runs: number };
  },
});
const rowsOf = (s: Summary, title: string) => s.sections.find((x) => x.title === title)!.rows;

test("every live figure equals what the app serves", async ({ page }) => {
  const { summary, reference } = await served(page);
  await gotoPage(page, "?view=everything");
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  const headline = (label: string) => summary.headline.find((r) => r.label === label)!.value;
  for (const el of await page.locator('[data-figure="totalInnings"]').all()) await expect(el).toHaveText(headline("Innings"));
  await expect(page.locator('[data-figure="dateRange"]').first()).toHaveText(headline("Dates"));
  await expect(page.locator('[data-figure="downloaded"]').first()).toHaveText(headline("Downloaded from Cricsheet"));
  await expect(figure(page, "testPopulation")).toHaveText(rowsOf(summary, "Test population").find((r) => r.label === "In the test population")!.value);

  const competitions = rowsOf(summary, "Innings per competition");
  const body = page.locator('[data-figure-list="competitions"] tr');
  await expect(body).toHaveCount(competitions.length);
  for (const [i, c] of competitions.entries()) {
    await expect(body.nth(i).locator("th")).toHaveText(c.label);
    await expect(body.nth(i).locator("td")).toHaveText(c.value);
  }
  const excluded = rowsOf(summary, "Excluded, and why");
  const terms = page.locator('[data-testid="exclusions"] dt');
  await expect(terms).toHaveCount(excluded.length);
  for (const [i, r] of excluded.entries()) await expect(terms.nth(i)).toContainText(`${r.label}, ${r.value}`);
  const sum = excluded.reduce((n, r) => n + Number(r.value.replace(/,/g, "")), 0);
  await expect(figure(page, "excludedTotal")).toHaveText(sum.toLocaleString("en-US"));

  await expect(figure(page, "refInnings")).toHaveText(reference.training.innings.toLocaleString("en-US"));
  await expect(figure(page, "refFirstYear")).toHaveText(String(reference.training.first_year));
  await expect(figure(page, "refLastYear")).toHaveText(String(reference.training.last_year));
  await expect(figure(page, "knowNothingMiss")).toHaveText(reference.figures.know_nothing.average_miss.toFixed(1));
  await expect(figure(page, "tvMiss")).toHaveText(reference.figures.broadcaster.average_miss.toFixed(1));
  await expect(figure(page, "tvBias")).toHaveText(Math.abs(reference.figures.broadcaster.bias).toFixed(1));
  await expect(figure(page, "tvBiasWords")).toHaveText(reference.figures.broadcaster.bias < 0 ? "too low" : "too high");
  for (const el of await page.locator('[data-figure="goalMargin"]').all()) await expect(el).toHaveText(String(reference.goal.margin_runs));
});

test("no dropped or hard-coded figure is on the page", async ({ page }) => {
  const { summary } = await served(page);
  await gotoPage(page, "?view=everything");
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  // the live figures are taken out, so what is left is the page's own typed text
  const typed = await page.locator("main").evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-figure], [data-figure-list], graph-replay").forEach((n) => n.remove());
    return copy.textContent ?? "";
  });
  expect(typed).not.toMatch(/\b(176|196|171|2,133|5,209|2,872)\b/);
  expect(typed).not.toMatch(/\b(19|20)\d\d\b/);                      // no year typed in
  expect(typed).not.toMatch(/\b19 possible|\b12 steps\b|\b2 use a language/);
  expect(typed).not.toContain(summary.headline.find((r) => r.label === "Innings")!.value);
});

test("with /api/data failing the text stays and only the data figures show the placeholder", async ({ page }) => {
  await page.route("**/api/data", (route) => route.abort());
  await gotoPage(page, "?view=everything");
  await expect(figure(page, "tvMiss")).not.toHaveText(PLACEHOLDER);        // the reference still fills
  await expect(page.locator('[data-testid="counts-table"]')).toContainText(PLACEHOLDER);
  await expect(page.locator('[data-testid="exclusions"]')).toContainText(PLACEHOLDER);
  await expect(figure(page, "excludedTotal")).toHaveText(PLACEHOLDER);
  await expect(page.locator('[data-figure-group="data-span"]')).toHaveText(GROUP_PLACEHOLDER);
  await expect(page.locator('[data-figure-group="population"]')).toHaveText(GROUP_PLACEHOLDER);
  await expect(page.locator('[data-figure-group="reference-bar"]')).not.toHaveText(GROUP_PLACEHOLDER);
  await expect(page.getByTestId("fact-steps")).not.toHaveText(PLACEHOLDER);
  await expect(page.locator("section#shipping")).toContainText("after 90 seconds");
});

test("with /api/reference failing the reference sentences are replaced whole and the data figures still fill", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.fulfill({ status: 500, body: "nope" }));
  await gotoPage(page, "?view=everything");
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  for (const group of ["reference-bar", "tv-bias"]) await expect(page.locator(`[data-figure-group="${group}"]`)).toHaveText(GROUP_PLACEHOLDER);
  await expect(figure(page, "tvMiss")).toHaveCount(0);                      // the sentence holding it is replaced whole
  await expect(page.locator('[data-figure-group="population"]')).not.toHaveText(GROUP_PLACEHOLDER);
});

test("with the structure, catalogue and models failing, only their figures show the placeholder", async ({ page }) => {
  await page.route(/\/api\/(structure|catalogue|models)$/, (route) => route.abort());
  await gotoPage(page, "?view=everything");
  await expect(page.getByTestId("fact-steps")).toHaveText(PLACEHOLDER);
  await expect(page.getByTestId("fact-clues")).toHaveText(PLACEHOLDER);
  await expect(page.getByTestId("gate-limits")).toHaveText(GROUP_PLACEHOLDER);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  await expect(page.locator("section#people")).toBeVisible();
});

// ---------------- look and device ----------------

test("the page has no sideways scroll at 390 px, with every panel open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await gotoPage(page, "?view=everything");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  await expect(page.getByTestId("fact-steps")).not.toHaveText(PLACEHOLDER);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the page matches the main page's width, font and background in both themes", async ({ browser }) => {
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme });
    const page = await context.newPage();
    const read = async (url: string) => {
      await page.goto(url);
      return page.evaluate(() => {
        const body = getComputedStyle(document.body), box = (document.querySelector(".page") as HTMLElement).getBoundingClientRect();
        return { font: body.fontFamily, bg: body.backgroundColor, color: body.color, width: Math.round(box.width) };
      });
    };
    expect(await read("/under-the-hood.html")).toEqual(await read("/"));
    await context.close();
  }
});

test("every link and button is at least 44 px tall and the switch comes before the content in the keyboard order", async ({ page }) => {
  await gotoPage(page);
  for (const el of await page.locator(".about-nav a, .about-nav button, .jump a, #people a").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  const order = await page.evaluate(() => {
    const all = [...document.querySelectorAll("a[href], button")];
    const at = (sel: string) => all.indexOf(document.querySelector(sel)!);
    return [at("[data-testid=view-switch]"), at("[data-testid=back-top]"), at("[data-testid=link-feedback]"), at("[data-testid=jump-links] a")];
  });
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order.every((i) => i >= 0)).toBe(true);
});
