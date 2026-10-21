import { expect, test, type Page } from "./fixtures";
import { contrastOf, open, openTab } from "./helpers";

// Feature 018: the "Under the hood" and "Feedback" links in the main page's header, and the "How this app was built" page.
// Figures on the page are compared with what /api/data and /api/reference send, never with numbers typed in here.

const ISSUES = "https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues";
const FEEDBACK_NAME = "Feedback (opens the GitHub issues page in a new tab)";
const TABS = ["data", "working", "found", "final-test", "try-your-own"] as const;
const STAGES = ["1", "2", "3", "4", "5-6", "7", "8"] as const;
const SECTIONS = ["question", "big-picture", "data", "play", "agent", "what-you-see", "shipping", "people"] as const;
const PLACEHOLDER = "not available right now";
const GROUP_PLACEHOLDER = "These figures are not available right now.";

const header = (page: Page, stage: string) => page.getByTestId(`stage-header-${stage}`);
const panel = (page: Page, stage: string) => page.getByTestId(`stage-panel-${stage}`);
const toggleAll = (page: Page) => page.getByTestId("toggle-all");
const figure = (page: Page, key: string) => page.locator(`[data-figure="${key}"]`).first();
const gotoPage = async (page: Page) => {
  await page.goto("/under-the-hood.html");
  await expect(page.getByRole("heading", { level: 1, name: "How this app was built" })).toBeVisible();
};

async function expectPanelsClosed(page: Page) {
  for (const s of STAGES) {
    await expect(header(page, s)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page, s)).toBeHidden();
  }
}

// ---------------- the header links on the main page ----------------

test("both header links are on every tab with the right targets", async ({ page }) => {
  await open(page);
  for (const tab of TABS) {
    await openTab(page, tab);
    const nav = page.getByTestId("about-nav");
    await expect(nav).toBeVisible();
    await expect(page.getByRole("navigation", { name: "About this app" })).toHaveCount(1);
    const hood = page.getByTestId("link-under-the-hood");
    await expect(hood).toHaveText("Under the hood");
    await expect(hood).toHaveAttribute("href", "/under-the-hood.html");
    await expect(hood).not.toHaveAttribute("target", /./);
    const feedback = page.getByRole("link", { name: FEEDBACK_NAME, exact: true });
    await expect(feedback).toHaveAttribute("href", ISSUES);
    await expect(feedback).toHaveAttribute("target", "_blank");
    await expect(feedback).toHaveAttribute("rel", /noopener/);
    await expect(feedback).toContainText("Feedback");
    // above the tab bar, beside the breadcrumb
    const [bar, tabs, crumb] = await Promise.all(["about-nav", "tab-working", "breadcrumb"].map(async (id) => (await page.getByTestId(id).boundingBox())!));
    expect(bar.y + bar.height).toBeLessThanOrEqual(tabs.y + 1);
    expect(bar.x).toBeGreaterThan(crumb.x);
  }
});

test("the header links are at least 44 px tall, hide their icons and show a focus outline", async ({ page }) => {
  await open(page);
  for (const id of ["link-under-the-hood", "link-feedback"]) {
    const link = page.getByTestId(id);
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await link.locator("svg:not([aria-hidden='true'])").count()).toBe(0);
    expect(await link.locator("svg").count()).toBeGreaterThan(0);
  }
  await page.getByTestId("link-under-the-hood").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("link-under-the-hood")).toBeFocused();
  expect(await page.getByTestId("link-under-the-hood").evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("link-feedback")).toBeFocused();
  expect(await page.getByTestId("link-feedback").evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
});

test("at phone width the links wrap onto their own row under the breadcrumb, with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  const nav = (await page.getByTestId("about-nav").boundingBox())!;
  const crumb = (await page.getByTestId("breadcrumb").boundingBox())!;
  expect(nav.y).toBeGreaterThanOrEqual(crumb.y + crumb.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Under the hood opens the page; the Feedback link opens a new tab and leaves the app alone", async ({ page, context }) => {
  await open(page);
  const popupPromise = context.waitForEvent("page");
  // block the real GitHub request so the test never leaves the machine
  await context.route("https://github.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "issues" }));
  await page.getByRole("link", { name: FEEDBACK_NAME, exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(ISSUES);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  expect(page.url()).not.toContain("github.com");
  await popup.close();

  await page.getByTestId("link-under-the-hood").click();
  await expect(page).toHaveURL(/\/under-the-hood\.html$/);
  await expect(page.getByRole("heading", { level: 1, name: "How this app was built" })).toBeVisible();
});

// ---------------- the page ----------------

test("the page loads directly with its heading block, top bar and every section", async ({ page }) => {
  await gotoPage(page);
  await expect(page.getByText("Under the hood · linear regression")).toBeVisible();
  await expect(page.getByText("The question it answers, the data it learns from, what happens when you press Play, and how the answer reaches the page.")).toBeVisible();
  const headings: Record<string, string> = {
    question: "The question", "big-picture": "The big picture", data: "The data, prepared before anyone visits",
    play: "What happens when you press Play", agent: "Inside the agent", "what-you-see": "What you see on the page", shipping: "How it is built and shipped",
    people: "John Fong",
  };
  for (const id of SECTIONS) {
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(page.locator(`section#${id} h2`)).toHaveText(headings[id]);
  }
  for (const part of ["Part 1", "Part 2", "Part 3", "Part 4", "Part 5"]) await expect(page.locator("p.part", { hasText: part })).toBeVisible();
  await expect(page.locator("footer#footer")).toBeVisible();
  await expect(page.locator("footer#footer").getByRole("link", { name: "Cricsheet" })).toHaveAttribute("href", "https://cricsheet.org");
  await expect(page.locator("footer#footer")).toContainText("Open Data Commons Attribution License");
});

test("the page's cards, tables and chips are all there", async ({ page }) => {
  await gotoPage(page);
  for (const name of ["The goal", "The method", "The show", "Your browser", "A Python function on Vercel", "Two data files", "The code", "Deployment", "Part of a bigger site"])
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".exam-pill-validation")).toHaveText("VALIDATION");
  await expect(page.locator(".exam-pill-test")).toHaveText("TEST");
  await expect(page.getByRole("heading", { name: "Model Selection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hold-Out Test" })).toBeVisible();
  await expect(page.locator('[data-testid="graph-chips"] .chip')).toHaveCount(12);
  await expect(page.locator('[data-testid="graph-chips"] .chip.llm')).toHaveCount(2);
  await expect(page.locator('[data-testid="graph-chips"] .row')).toHaveCount(3);
  expect(await page.locator("section#agent table").first().locator("tbody tr").count()).toBe(8);
  await expect(page.locator("ol.steps li.gate")).toHaveCount(1);
  await expect(page.locator(".chips li")).toHaveCount(18);   // 14 measured features and 4 worked-out groups (five features)
});

test("the jump links point at the sections and move the page there", async ({ page }) => {
  await gotoPage(page);
  const links = page.getByTestId("jump-links").getByRole("link");
  await expect(links).toHaveText(["The question", "1 · The data", "2 · Pressing Play", "3 · Inside the agent", "4 · What you see", "5 · Shipping it", "Who built this"]);
  const targets = ["question", "data", "play", "agent", "what-you-see", "shipping", "people"];
  for (const [i, id] of targets.entries()) {
    await expect(links.nth(i)).toHaveAttribute("href", `#${id}`);
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
  await links.nth(5).click();
  await expect(page).toHaveURL(/#shipping$/);
  await expect(page.locator("#h-ship")).toBeInViewport();
  await links.nth(6).click();
  await expect(page).toHaveURL(/#people$/);
  await expect(page.locator("#h-people")).toBeInViewport();
});

// Feature 019: the author and tester credits at the end of the page.
const AUTHOR_URL = "https://www.linkedin.com/in/john-fong-04b7a120/";
const TESTER_URL = "https://www.linkedin.com/in/alesja-tanabe-3207931b1";
const AUTHOR_LINK = "View LinkedIn profile for John Fong (opens in a new tab)";
const TESTER_LINK = "View LinkedIn profile for Alesja Tanabe (opens in a new tab)";

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
  expect(await people.evaluate((el) => el.nextElementSibling?.id)).toBe("footer");
  await expect(page.locator("img, picture, video")).toHaveCount(0);
});

test("the footer credits the author and tester above the Cricsheet attribution", async ({ page }) => {
  await gotoPage(page);
  const paras = page.locator("footer#footer > p");
  await expect(paras.nth(0)).toHaveText("Built by John Fong · Tested by Alesja Tanabe");
  await expect(paras.nth(1)).toContainText("Cricsheet");
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
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("data-testid", id);
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    expect(box.width).toBeLessThan(sectionWidth / 2);
    await link.focus();
    expect(parseFloat(await link.evaluate((el) => getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
  }
});

test("the main page header has no Author link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /author|who built/i })).toHaveCount(0);
});

test("Back to the app and Feedback work at the top and in the footer", async ({ page }) => {
  await gotoPage(page);
  for (const id of ["back-top", "back-footer"]) {
    await expect(page.getByTestId(id)).toHaveText("Back to the app");
    await expect(page.getByTestId(id)).toHaveAttribute("href", "/");
  }
  const top = page.getByTestId("link-feedback");
  await expect(top).toHaveAttribute("href", ISSUES);
  await expect(top).toHaveAttribute("target", "_blank");
  await expect(top).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("link", { name: FEEDBACK_NAME, exact: true })).toHaveCount(1);
  const foot = page.getByTestId("link-feedback-footer");
  await expect(foot).toContainText("Questions or ideas? Leave feedback");
  await expect(foot).toHaveAttribute("href", ISSUES);
  await expect(foot).toHaveAttribute("target", "_blank");
  await expect(foot).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("link", { name: /Questions or ideas\? Leave feedback.*new tab/ })).toHaveCount(1);

  await page.getByTestId("back-footer").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("breadcrumb")).toBeVisible();
  await page.goBack();
  await page.getByTestId("back-top").click();
  await expect(page.getByTestId("tab-working")).toBeVisible();
});

test("the page is reached from the main page link and back", async ({ page }) => {
  await open(page);
  await page.getByTestId("link-under-the-hood").click();
  await expect(page.locator("section#question")).toBeVisible();
  await page.getByTestId("back-top").click();
  await expect(page.getByTestId("hero")).toBeVisible();
});

// ---------------- the stage panels ----------------

test("the seven stage panels start closed and show only the number, name and summary", async ({ page }) => {
  await gotoPage(page);
  await expect(page.locator("button.stage-head")).toHaveCount(7);
  await expectPanelsClosed(page);
  await expect(toggleAll(page)).toHaveText("Expand all");
  for (const s of STAGES) {
    const head = header(page, s);
    await expect(head.locator(".stage-num")).toHaveText(s === "5-6" ? "5–6" : s);
    await expect(head.locator("strong")).not.toBeEmpty();
    await expect(head.locator(".stage-sum")).not.toBeEmpty();
    await expect(head).toHaveAttribute("aria-controls", `stage-panel-${s}`);
    await expect(page.locator(`#stage-panel-${s}`)).toHaveCount(1);
    expect((await head.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await toggleAll(page).boundingBox().then((b) => b!.height)).toBeGreaterThanOrEqual(44);
});

test("each panel opens and closes on its own and the chevron turns over", async ({ page }) => {
  await gotoPage(page);
  const chevron = (s: string) => header(page, s).locator(".chev").evaluate((el) => getComputedStyle(el).transform);
  const closedTransform = await chevron("3");
  await header(page, "3").click();
  await expect(header(page, "3")).toHaveAttribute("aria-expanded", "true");
  await expect(panel(page, "3")).toBeVisible();
  await expect.poll(() => chevron("3")).not.toBe(closedTransform);
  for (const s of STAGES.filter((s) => s !== "3")) await expect(header(page, s)).toHaveAttribute("aria-expanded", "false");
  await header(page, "7").click();                               // two open at once
  await expect(panel(page, "3")).toBeVisible();
  await expect(panel(page, "7")).toBeVisible();
  await header(page, "3").click();
  await expect(header(page, "3")).toHaveAttribute("aria-expanded", "false");
  await expect(panel(page, "3")).toBeHidden();
  await expect(panel(page, "7")).toBeVisible();
  await expect.poll(() => chevron("3")).toBe(closedTransform);
  // anywhere on the row opens it, including the summary text
  await header(page, "5-6").locator(".stage-sum").click();
  await expect(header(page, "5-6")).toHaveAttribute("aria-expanded", "true");
});

test("Expand all and Collapse all open and close every panel and follow the real state", async ({ page }) => {
  await gotoPage(page);
  await toggleAll(page).click();
  for (const s of STAGES) await expect(header(page, s)).toHaveAttribute("aria-expanded", "true");
  await expect(toggleAll(page)).toHaveText("Collapse all");
  await toggleAll(page).click();
  await expectPanelsClosed(page);
  await expect(toggleAll(page)).toHaveText("Expand all");

  await header(page, "2").click();                               // some open: it opens the rest
  await expect(toggleAll(page)).toHaveText("Expand all");
  await toggleAll(page).click();
  for (const s of STAGES) await expect(header(page, s)).toHaveAttribute("aria-expanded", "true");

  await header(page, "4").click();                               // one closed by hand: back to Expand all
  await expect(toggleAll(page)).toHaveText("Expand all");
  await header(page, "4").click();                               // and reopened: Collapse all again
  await expect(toggleAll(page)).toHaveText("Collapse all");

  await page.reload();                                           // nothing is remembered
  await expectPanelsClosed(page);
  await expect(toggleAll(page)).toHaveText("Expand all");
});

test("the panels work from the keyboard with Enter and Space", async ({ page }) => {
  await gotoPage(page);
  await header(page, "1").focus();
  await page.keyboard.press("Enter");
  await expect(header(page, "1")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(header(page, "1")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Tab");
  await expect(header(page, "2")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(header(page, "2")).toHaveAttribute("aria-expanded", "true");
  expect(await header(page, "2").evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
  await toggleAll(page).focus();
  await page.keyboard.press("Enter");
  await expect(toggleAll(page)).toHaveText("Collapse all");
});

test("the chevron does not animate for a visitor who prefers reduced motion", async ({ browser }) => {
  const motion = async (reducedMotion: "reduce" | "no-preference") => {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await gotoPage(page);
    const duration = await header(page, "1").locator(".chev").evaluate((el) => getComputedStyle(el).transitionDuration);
    await context.close();
    return duration;
  };
  expect(await motion("reduce")).toBe("0s");
  expect(await motion("no-preference")).not.toBe("0s");
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
  await gotoPage(page);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  const headline = (label: string) => summary.headline.find((r) => r.label === label)!.value;
  await expect(page.locator('[data-figure="totalInnings"]').first()).toHaveText(headline("Innings"));
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
  await expect(page.locator('[data-testid="exclusions"] dd').first()).not.toBeEmpty();   // the known reasons are explained

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
  await gotoPage(page);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  await toggleAll(page).click();
  // the live figures are taken out, so what is left is the page's own typed text
  const typed = await page.locator("main").evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-figure], [data-figure-list]").forEach((n) => n.remove());
    return copy.textContent ?? "";
  });
  expect(typed).not.toMatch(/45 seasons/);
  expect(typed).not.toMatch(/Matches read/i);
  expect(typed).not.toMatch(/\b0\.75\b/);
  expect(typed).not.toMatch(/\b(176|196|171|2,133|5,209|2,872)\b/);
  expect(typed).not.toMatch(/\b(19|20)\d\d\b/);                      // no year typed in
  expect(typed).not.toMatch(/example run/i);
  expect(typed).not.toMatch(/Our pick \(the rival/);
  const served5 = summary.headline.find((r) => r.label === "Innings")!.value;
  expect(typed).not.toContain(served5);
});

test("with /api/data failing the text stays and only the data figures show the placeholder", async ({ page }) => {
  await page.route("**/api/data", (route) => route.abort());
  await gotoPage(page);
  await expect(figure(page, "tvMiss")).not.toHaveText(PLACEHOLDER);        // the reference still fills
  await expect(page.locator('[data-testid="counts-table"]')).toContainText(PLACEHOLDER);
  await expect(page.locator('[data-testid="exclusions"]')).toContainText(PLACEHOLDER);
  await expect(figure(page, "excludedTotal")).toHaveText(PLACEHOLDER);
  await expect(page.locator('[data-figure-group="data-span"]')).toHaveText(GROUP_PLACEHOLDER);
  await expect(page.locator('[data-figure-group="population"]')).toHaveText(GROUP_PLACEHOLDER);
  await expect(page.locator('[data-figure-group="reference-bar"]')).not.toHaveText(GROUP_PLACEHOLDER);
  await expect(page.locator("section#question")).toContainText("A language model proposes candidate models");
  await expect(page.locator("section#shipping")).toContainText("90-second limit");
  await header(page, "1").click();
  await expect(panel(page, "1")).toBeVisible();
});

test("with /api/reference failing the reference sentences are replaced whole and the data figures still fill", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.fulfill({ status: 500, body: "nope" }));
  await gotoPage(page);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  for (const group of ["reference-bar", "tv-bias", "goal"]) await expect(page.locator(`[data-figure-group="${group}"]`)).toHaveText(GROUP_PLACEHOLDER);
  await expect(figure(page, "tvMiss")).toHaveText(PLACEHOLDER);
  await expect(figure(page, "knowNothingMiss")).toHaveText(PLACEHOLDER);
  await expect(page.locator('[data-figure-group="population"]')).not.toHaveText(GROUP_PLACEHOLDER);
});

test("with both routes failing every figure shows the placeholder and the panels still work", async ({ page }) => {
  await page.route(/\/api\/(data|reference)$/, (route) => route.abort());
  await gotoPage(page);
  await toggleAll(page).click();
  await expect(toggleAll(page)).toHaveText("Collapse all");
  await expect(page.locator('[data-figure-group="stage1-ok"]')).toHaveText(GROUP_PLACEHOLDER);
  const left = await page.evaluate(() => [...document.querySelectorAll("[data-figure]")].map((n) => n.textContent));
  expect(left.length).toBeGreaterThan(0);
  expect(new Set(left)).toEqual(new Set([PLACEHOLDER]));
  await expect(page.locator("section#question")).toBeVisible();
});

// ---------------- look and device ----------------

test("the page has no sideways scroll at 360 px, even with every panel open", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoPage(page);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  await toggleAll(page).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  // anything wider than the screen sits inside a box that scrolls on its own
  const stray = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("main *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= document.documentElement.clientWidth + 0.5) continue;
      let ok = false;
      for (let n: HTMLElement | null = el.parentElement; n && n !== document.body; n = n.parentElement)
        if (getComputedStyle(n).overflowX === "auto" || getComputedStyle(n).overflowX === "scroll") { ok = true; break; }
      if (!ok) out.push(`${el.tagName}.${el.className}`);
    }
    return out;
  });
  expect(stray).toEqual([]);
});

test("the page matches the main page's width, font and background in both themes", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const probe = () => page.evaluate(() => {
      const body = getComputedStyle(document.body), main = getComputedStyle(document.querySelector("main")!);
      return { font: body.fontFamily, size: body.fontSize, bg: body.backgroundColor, color: body.color, maxWidth: main.maxWidth, accent: getComputedStyle(document.documentElement).getPropertyValue("--accent") };
    });
    await page.goto("/");
    const mainPage = await probe();
    await gotoPage(page);
    expect(await probe()).toEqual(mainPage);
    await context.close();
  }
});

test("text is readable in both themes and every control is a real link or button", async ({ page }) => {
  await gotoPage(page);
  await expect(figure(page, "totalInnings")).not.toHaveText(PLACEHOLDER);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const selector of ["main > section p", ".card p.muted", ".tester-kicker", ".pill-link", ".lead", ".eyebrow", ".jump a", ".about-link", ".page-foot p", ".note", ".exam-pill-validation", ".exam-pill-test", ".stage-sum", ".chip.llm", ".steps .gate .n"])
      expect(await contrastOf(page, selector), `${scheme} ${selector}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(await page.locator("[onclick], [role=button]:not(button), div[tabindex]").count()).toBe(0);
});

test("every link and button is at least 44 px tall and keyboard order follows the page", async ({ page }) => {
  await gotoPage(page);
  const controls = page.locator("main a[href], main button");
  const total = await controls.count();
  expect(total).toBeGreaterThan(15);
  for (let i = 0; i < total; i++) {
    const c = controls.nth(i);
    if (!(await c.isVisible())) continue;
    const label = (await c.textContent())?.trim().slice(0, 30);
    const inline = await c.evaluate((el) => el.closest("p, li, dd, td") !== null);        // a link inside a sentence is as tall as its line
    if (!inline) expect((await c.boundingBox())!.height, label).toBeGreaterThanOrEqual(43.5);
  }
  // tabbing visits the top bar first, then the jump links, then the stage controls, then the footer, each with an outline
  const seen: string[] = [];
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return { id: el.dataset.testid ?? el.textContent?.trim().slice(0, 20) ?? "", outline: parseFloat(getComputedStyle(el).outlineWidth) };
    });
    seen.push(info.id);
    expect(info.outline, info.id).toBeGreaterThan(0);
    if (info.id === "link-feedback-footer") break;
  }
  expect(seen.slice(0, 2)).toEqual(["back-top", "link-feedback"]);
  expect(seen.indexOf("toggle-all")).toBeGreaterThan(seen.indexOf("The question"));
  expect(seen.indexOf("stage-header-1")).toBe(seen.indexOf("toggle-all") + 1);
  expect(seen.at(-1)).toBe("link-feedback-footer");
  const order = ["stage-header-7", "link-linkedin-author", "link-linkedin-tester", "back-footer", "link-feedback-footer"].map((id) => seen.indexOf(id));
  expect(order.every((n) => n >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});
