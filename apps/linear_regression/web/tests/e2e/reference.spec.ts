import { expect, test, type Page } from "./fixtures";
import { runToEnd } from "./helpers";

// How good the references are and the goal's wording (the hero's own tests are in hero.spec.ts). Every figure on the page is
// compared with what the server sent, never with a number typed in here.

interface Figures { n: number; average_miss: number }
interface Reference {
  goal: { reference: string; margin_runs: number; text: string; lead: string };
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: { know_nothing: Figures; broadcaster: Figures } | null;
  hero: { caption: string | null; panel: string; panel_emphasis: string[]; footnote: string; chart_text: string | null } | null;
}

const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json()) as Reference;

test("the pick's verdict reads in the goal's words, with the runs, and says whether the goal was reached", async ({ page }) => {
  await runToEnd(page, "?view=everything&interval=40");
  const ref = await reference(page);
  const verdict = page.getByTestId("pick-verdict");
  await expect(verdict).toContainText(/reaches the goal|short of the goal|did not beat/);
  await expect(verdict).toContainText(`at least ${ref.goal.margin_runs} runs`);
});

test("the goal's margin in the hero's panel is the server's, and the pick's verdict names the same margin", async ({ page }) => {
  await runToEnd(page, "?view=everything&interval=40");
  const ref = await reference(page);
  await expect(page.getByTestId("tv-sentence")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(page.getByTestId("goal-sentence")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(page.getByTestId("pick-verdict")).toContainText(`at least ${ref.goal.margin_runs} runs`);
});

test("the hero itself holds no hand-written goal: without the server's figures it shows none", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await page.goto("/?view=everything");
  await expect(page.getByTestId("hero-unavailable")).toBeVisible();
  await expect(page.getByTestId("tv-sentence")).toHaveCount(0);                                // nothing is shown that the server did not send
  expect((await page.getByTestId("hero").textContent()) ?? "").not.toMatch(/at least \d+ runs/);
});

test("the hero's footnote says what the agent is tested on and how many innings the figures rest on, as the server sent it", async ({ page }) => {
  await page.goto("/?view=everything");
  const ref = await reference(page);
  const footnote = page.getByTestId("tv-footnote");
  await expect(footnote).toBeVisible();
  await expect(footnote).toHaveText(ref.hero!.footnote);
  await expect(footnote).toContainText("IPL");
  await expect(footnote).toContainText("BBL");
  await expect(footnote).toContainText("full-member internationals");
});

test("the reference figures are on the test population before the first check year and equal the server's", async ({ page }) => {
  await page.goto("/?view=everything");
  const ref = await reference(page);
  await expect(page.getByTestId("tv-footnote")).toBeVisible();
  expect(ref.training!.innings).toBeLessThan(4000);                      // fewer than all the early innings (about 4,000)
  await expect(page.getByTestId("tv-footnote")).toContainText(ref.training!.innings.toLocaleString("en-US"));
  await expect(page.getByTestId("tv-footnote")).toContainText(`${ref.training!.first_year} to ${ref.training!.last_year}`);
  await expect(page.getByTestId("tv-miss")).toHaveText(ref.figures!.broadcaster.average_miss.toFixed(1));
  await expect(page.getByTestId("nothing-miss")).toHaveText(ref.figures!.know_nothing.average_miss.toFixed(1));
});

test("the page never calls any method the winner", async ({ page }) => {
  await page.goto("/?view=everything");
  await expect(page.getByTestId("verdict-title")).toBeVisible();
  expect((await page.locator("main").innerText()).toLowerCase()).not.toContain("winner");
  expect((await page.locator("main").innerText()).toLowerCase()).not.toContain("shortest bar");
});
