// The problem (feature 020): the TV projection is usually about so many runs out, shown with one real innings; the run-by-over
// chart with the zoom on the finish is in Commentary.
import { expect, test, type Page } from "./fixtures";

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("problem-title")).toBeVisible();
}
const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json());

test("the heading, the question and the three tiles come from the reference figures", async ({ page }) => {
  await open(page);
  const ref = await reference(page);
  await expect(page.locator("#problem .kicker").first()).toHaveText("THE PROBLEM");
  await expect(page.getByTestId("problem-title")).toHaveText(`The TV projection is usually about ${ref.figures.broadcaster.average_miss.toFixed(1)} runs out.`);
  await expect(page.getByTestId("problem-lead")).toHaveText(
    `It just multiplies the run rate by 20. Can an agent, left to itself, learn something smarter from ${ref.training.innings.toLocaleString("en-GB")} past innings?`);
  const e = ref.example;
  await expect(page.getByTestId("tile-score-at-10")).toContainText(`${e.runs_at_10}/${e.wickets_at_10}`);
  await expect(page.getByTestId("tile-score-at-10")).toContainText("Score after 10 overs");
  await expect(page.getByTestId("tile-tv-said")).toContainText(String(e.tv_projection));
  await expect(page.getByTestId("tile-final-total")).toContainText(String(e.final_total));
  await expect(page.getByTestId("problem-caption")).toHaveText(`${e.batting_team} v ${e.bowling_team}, ${e.venue}, ${e.date_label}`);
});

test("the run-by-over chart and its zoom are in Commentary, closed until asked for", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("worm-card")).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("worm-card")).toBeVisible();
  const ref = await reference(page);
  await expect(page.getByTestId("worm-caption")).toHaveText(ref.hero.caption);
  await expect(page.getByTestId("worm-chart").locator("svg").first()).toHaveAttribute("aria-label", ref.hero.chart_text);
});

test("without the reference figures the section says so and shows no number", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.fulfill({ status: 500, body: "no" }));
  await page.goto("/");
  await expect(page.getByTestId("problem-unavailable")).toBeVisible();
  await expect(page.getByTestId("problem-tiles")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the tiles stack and nothing scrolls sideways, chart open", async ({ page }) => {
    await open(page, "?view=everything");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const a = (await page.getByTestId("tile-score-at-10").boundingBox())!, b = (await page.getByTestId("tile-tv-said").boundingBox())!;
    expect(b.y).toBeGreaterThan(a.y);
  });
});
