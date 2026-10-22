// The Scorebook (feature 020): the full reference views, never inline. Four cards; one full-width panel at a time; the data is
// fetched only when its panel is first opened; the ranked list and the brute-force search's grids keep today's content.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const stateOf = () => Object.assign({}, ...recorded().events.map((e: { changes: object }) => e.changes));

interface Cell { training_innings: string; window: string; weighting: string; allowed: boolean; validation_mae: number | null }
const card = (page: Page, id: string) => page.getByTestId(`scorebook-card-${id}`);
const panel = (page: Page) => page.getByTestId("scorebook-panel");

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("scorebook-cards")).toBeVisible();
}
function dataRequests(page: Page) {
  let n = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/data") n++; });
  return () => n;
}
const menuLabel = async (page: Page) => {
  const menus = (await (await page.request.get("/api/catalogue")).json()).setup_menus as Record<string, { id: string; label: string }[]>;
  return (menu: string, id: string) => menus[menu].find((o) => o.id === id)!.label;
};

test("the section has its kicker, heading and four cards, and no panel is open", async ({ page }) => {
  await open(page);
  await expect(page.locator("#scorebook .kicker").first()).toHaveText("THE SCOREBOOK");
  await expect(page.locator("#scorebook-title")).toHaveText("For the data scientists: every detail.");
  await expect(card(page, "models")).toContainText("Every idea tried");
  await expect(card(page, "graph")).toContainText("The agent graph, step by step");
  await expect(card(page, "data")).toContainText("The data");
  await expect(card(page, "built")).toContainText("How this app was built");
  await expect(panel(page)).toBeHidden();
  await expect(card(page, "built")).toHaveAttribute("href", "/under-the-hood.html");
});

test("Every idea tried: the ranked list and the brute-force search's two grids, in a full-width panel below the cards", async ({ page }) => {
  await open(page);
  await card(page, "models").click();
  await expect(panel(page)).toBeVisible();
  await expect(card(page, "models")).toHaveAttribute("aria-expanded", "true");
  const cards = (await page.getByTestId("scorebook-cards").boundingBox())!, p = (await panel(page).boundingBox())!;
  expect(p.y).toBeGreaterThanOrEqual(cards.y + cards.height - 1);
  expect(p.width).toBeGreaterThanOrEqual(cards.width - 2);

  const state = stateOf();
  const label = await menuLabel(page);
  const ai = state.attempts.filter((a: { proposer: string }) => a.proposer === "llm");
  const cells = (state.grid.cells as Cell[]).filter((c) => c.allowed);
  const rows = page.getByTestId("attempt-row");
  await expect(rows).toHaveCount(ai.length + cells.length);
  const chips = await rows.evaluateAll((els) => els.map((r) => Array.from(r.querySelectorAll(".setup-chip")).map((c) => c.textContent)));
  const wanted = [...ai, ...cells].map((a) => [label("window", a.window), label("weighting", a.weighting), label("training_innings", a.training_innings)]);
  expect(chips.map((c) => c.join("|")).sort()).toEqual(wanted.map((c) => c.join("|")).sort());
  const misses = (await rows.locator(".rank-miss").allTextContents()).map(Number);
  expect(misses).toEqual([...misses].sort((x, y) => x - y));                      // ranked by average miss
  await expect(page.getByTestId("ranking").locator("thead th")).toHaveText(["#", "Idea", "Found by", "Average miss on check seasons (runs)"]);
  await expect(page.getByTestId("ranking-tv")).toContainText("The TV projection missed by");

  await expect(page.getByTestId("grid-table")).toHaveCount(2);
  await expect(page.getByTestId("grid-cell")).toHaveCount(24);
  for (const t of await page.getByTestId("grid-table").all()) {
    expect(await t.locator("tbody tr").count()).toBe(4);                         // the four windows
    expect(await t.locator("thead th").count()).toBe(1 + 3);                     // the row heading and the three weightings
  }
  const best = page.locator('[data-testid="grid-cell"][data-best="true"]');
  await expect(best).toHaveCount(1);
  await expect(best).toHaveText(`★ ${state.grid.best.validation_mae.toFixed(1)}`);
  await expect(page.getByTestId("grid-best")).toContainText(`The brute-force search's best: ${state.grid.best.validation_mae.toFixed(1)} runs on the check seasons.`);
  expect(await best.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");      // an outline, so it does not rely on colour
});

test("only one panel is open at a time: opening another replaces it, and the same card again closes it", async ({ page }) => {
  await open(page);
  await card(page, "models").click();
  await expect(page.getByTestId("scorebook-models")).toBeVisible();
  await card(page, "data").click();
  await expect(card(page, "data")).toHaveAttribute("aria-expanded", "true");
  await expect(card(page, "models")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("scorebook-models")).toHaveCount(0);
  await expect(page.locator("data-grid")).toBeVisible();
  await expect(page.getByTestId("scorebook-panel")).toHaveCount(1);
  await card(page, "data").click();
  await expect(panel(page)).toBeHidden();
});

test("the close button and Escape close the panel and return focus to the card that opened it", async ({ page }) => {
  await open(page);
  await card(page, "models").click();
  await page.getByTestId("scorebook-close").click();
  await expect(panel(page)).toBeHidden();
  await expect(card(page, "models")).toBeFocused();
  await card(page, "data").click();
  await page.getByTestId("scorebook-close").focus();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(card(page, "data")).toBeFocused();
});

test("The data: /api/data is fetched only when the panel is first opened, once, and the grid works", async ({ page }) => {
  const requests = dataRequests(page);
  await open(page, "?view=everything");
  await page.waitForTimeout(800);
  expect(requests()).toBe(0);                                                    // not on load, not with Show me everything
  await card(page, "data").click();
  await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
  expect(requests()).toBe(1);
  await expect(page.getByTestId("data-summary")).toBeVisible();
  await expect(page.getByTestId("download-csv")).toBeVisible();
  await expect(page.getByTestId("data-search")).toBeVisible();
  await card(page, "data").click();
  await card(page, "data").click();
  await expect(page.getByTestId("data-count")).toContainText("Showing");
  expect(requests()).toBe(1);                                                    // kept in memory by the grid
});

test("The agent graph opens the full graph in Watch it think and scrolls to it", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("graph-panel")).toBeHidden();
  await card(page, "graph").click();
  await expect(page.getByTestId("graph-panel")).toBeVisible();
  await expect(page.getByTestId("graph-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(panel(page)).toBeHidden();                                        // it is the same panel as in Watch it think, not a copy
  await expect.poll(async () => (await page.getByTestId("graph-panel").boundingBox())!.y).toBeLessThan(400);
});

test("the Scorebook stays closed with Show me everything", async ({ page }) => {
  await open(page, "?view=everything");
  await expect(panel(page)).toBeHidden();
  for (const id of ["models", "data"]) await expect(card(page, id)).toHaveAttribute("aria-expanded", "false");
});

test("every card is a real button or link, at least 44 px tall, with a visible focus outline", async ({ page }) => {
  await open(page);
  for (const id of ["models", "graph", "data", "built"]) {
    const c = card(page, id);
    expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await c.focus();
    expect(await c.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the cards stack, the panel fits, and a wide table scrolls inside its own box", async ({ page }) => {
    await open(page);
    const a = (await card(page, "models").boundingBox())!, b = (await card(page, "graph").boundingBox())!;
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    await card(page, "models").click();
    await expect(panel(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await card(page, "data").click();
    await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
