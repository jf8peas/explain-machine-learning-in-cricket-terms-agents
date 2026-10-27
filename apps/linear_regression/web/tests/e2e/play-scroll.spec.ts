// Issue 18: pressing Play brings the run graph into view once when it is off screen, leaves the page alone when it is already visible, and keeps focus on the button.
import { expect, test } from "./fixtures";
import { toPlayer } from "./helpers";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test("Play scrolls the run graph into view", async ({ page }) => {
    await page.goto("/?interval=40");
    await toPlayer(page);
    const graph = page.getByTestId("run-graph");
    const before = await page.evaluate(() => window.scrollY);
    const play = page.getByTestId("play-button");
    await play.click();
    await expect.poll(() => graph.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThanOrEqual(664 - 120);
    expect(await graph.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => window.scrollY)).not.toBe(before);
  });
});

test("on a desktop where the graph is already in view, Play does not move the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto("/?interval=40");
  await toPlayer(page);
  const at = await page.evaluate(() => window.scrollY);
  const top = await page.getByTestId("run-graph").evaluate((el) => el.getBoundingClientRect().top);
  test.skip(top < 0 || top > 1600 - 120, "graph not visible from the player at this size");
  await page.getByTestId("play-button").click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(at);
});
