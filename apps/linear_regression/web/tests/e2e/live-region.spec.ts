// The round feed is announced through one polite live region, one short line for each new round, and never twice (feature 020,
// FR-018). Going back or jumping says nothing. The feed itself is not a live region, so it is not read out again as it grows.
import { readFileSync } from "node:fs";
import { toPlayer } from "./helpers";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const rounds = () => Object.assign({}, ...recorded().events.map((e: { changes: object }) => e.changes)).rounds as { round: number }[];

/** Every text the live region has held, in order. */
async function watchRegion(page: Page) {
  await page.evaluate(() => {
    const region = document.querySelector("[data-testid=round-live-region]") as HTMLElement;
    (window as unknown as { spoken: string[] }).spoken = [];
    new MutationObserver(() => {
      const text = region.textContent ?? "";
      if (text) (window as unknown as { spoken: string[] }).spoken.push(text);
    }).observe(region, { childList: true, characterData: true, subtree: true });
  });
}
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);

test("the region is polite, atomic and hidden from sight, and the feed is not a live region", async ({ page }) => {
  await page.goto("/");
  const region = page.getByTestId("round-live-region");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region).toHaveAttribute("aria-atomic", "true");
  const box = await region.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(1);
  expect(box!.height).toBeLessThanOrEqual(1);
  const feed = page.getByTestId("round-feed");
  await expect(feed).not.toHaveAttribute("aria-live", /.+/);
  expect(await feed.evaluate((el) => !!el.closest("[aria-live]"))).toBe(false);
});

test("each round is spoken once, in one short line, as it gets its status", async ({ page }) => {
  await page.goto("/?interval=150");
  await watchRegion(page);
  await toPlayer(page);
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch again", { timeout: 30_000 });
  const lines = await spoken(page);
  expect(lines.length).toBe(rounds().length);
  expect(lines.map((l) => Number(/^Round (\d+):/.exec(l)?.[1]))).toEqual(rounds().map((r) => r.round));
  for (const line of lines) expect(line.length).toBeLessThan(80);
  expect(new Set(lines).size).toBe(lines.length);
});

test("going back, stepping back and jumping say nothing, and the rounds already heard are not read out again", async ({ page }) => {
  await page.goto("/?interval=120&view=everything");
  await watchRegion(page);
  await toPlayer(page);
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch again", { timeout: 30_000 });
  const before = (await spoken(page)).length;
  const replay = page.locator("graph-replay");
  for (let i = 0; i < 3; i++) await replay.getByTestId("back").click();
  await replay.getByTestId("path").locator("> summary").click();
  await replay.getByTestId("timeline-item").first().click();                // jump to the first step
  await replay.getByTestId("timeline-item").last().click();                 // and to the last
  await page.waitForTimeout(300);
  expect((await spoken(page)).length).toBe(before);
});

test("a visitor who prefers reduced motion gets the finished run without it being read out round by round", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await watchRegion(page);
  await toPlayer(page);
  await expect(page.getByTestId("round-item")).toHaveCount(rounds().length);
  expect(await spoken(page)).toEqual([]);
});
