// The page before any run (feature 022): the question, the goal and the Start button, and nothing about a result. Replaces the old
// first-screen check, which read a recorded result.
import { expect, test } from "./fixtures";

test.describe("390 × 664, the screen LinkedIn's in-app browser gives", () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test("the question, the goal sentence and the Start button are on the first screen, with no sideways scroll", async ({ page }) => {
    await page.goto("/");
    const title = page.getByTestId("hero-title");
    await expect(title).toHaveText("Can an AI agent build its own prediction model and beat the TV?");
    await expect(page.getByTestId("goal-sentence")).toHaveText("Beat the TV's projection by at least 3 runs on average.");
    const start = page.getByTestId("start-experiment");
    await expect(start).toHaveText("▶ Start the experiment");
    for (const el of [title, page.getByTestId("goal-sentence"), start]) {
      const box = (await el.boundingBox())!;
      expect(box.y + box.height, "bottom of the element").toBeLessThanOrEqual(664);
    }
    expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test("the hero has the kicker, the lead and the goal card from the server, and no result", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero-kicker")).toHaveText("AN AI AGENT EXPERIMENT");
  await expect(page.getByTestId("hero-lead")).toHaveText(
    "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it is tested on a season it has never seen.");
  const ref = await (await page.request.get("/api/reference")).json();
  await expect(page.getByTestId("goal-kicker")).toHaveText("THE GOAL");
  await expect(page.getByTestId("goal-tv-figure")).toHaveText(ref.figures.broadcaster.average_miss.toFixed(1));
  await expect(page.getByTestId("goal-target-figure")).toHaveText("3+");
  await expect(page.getByTestId("goal-card")).toContainText(`on past innings (${ref.training.first_year}–${ref.training.last_year})`);
  await expect(page.getByTestId("goal-judged")).toHaveText(ref.goal_card.judged);
  await expect(page.getByTestId("goal-judged")).toContainText(`from ${ref.test.year}`);
  // nothing about the agent's result: no strip, no figures, no recorded label
  await expect(page.getByTestId("result-strip")).toHaveCount(0);
  await expect(page.getByText(/recorded/i)).toHaveCount(0);
  await expect(page.getByTestId("verdict-bars")).toHaveCount(0);
  await expect(page.getByTestId("link-try")).toHaveCount(0);              // "Try your own innings" needs a finished run
});

test("Start moves to the player and focuses the Choose the AI select", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("start-experiment").click();
  await expect(page).toHaveURL(/#watch$/);
  await expect(page.getByTestId("model-select")).toBeFocused();
  await expect(page.getByTestId("model-select")).toBeInViewport();
});

test("the idle page asks for no recorded file and no run, and a reload comes back idle", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(new URL(r.url()).pathname));
  await page.goto("/");
  await expect(page.getByTestId("player-status")).toHaveText("Ready. Choose the AI and press play.");
  expect(asked.filter((p) => /recorded/i.test(p))).toEqual([]);
  expect(asked).not.toContain("/api/run");
  await page.reload();
  await expect(page.getByTestId("player-status")).toHaveText("Ready. Choose the AI and press play.");
  await expect(page.getByTestId("verdict-locked")).toBeVisible();
});

test("the hero's Commentary is closed until Show me everything and holds three things", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByTestId("hero-commentary");
  await expect(panel).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("tv-sentence")).toBeVisible();
  await expect(page.getByTestId("why-unseen")).toContainText("Any model looks good on the data it chose from.");
  await expect(page.getByTestId("why-unseen")).toContainText("stays locked until the agent has picked its model, then it is used once.");
  await expect(page.getByTestId("who-does-what")).toContainText("Who does what:");
});
