// Issue 22: a finished run survives a visit to another page and back; a reload is still a fresh start; the in-text link stays in the same tab.
import { expect, test } from "./fixtures";
import { runToEnd } from "./helpers";

test("after a finished run, a visit to Under the hood and back finds the run, the verdict and Your turn as they were", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  const model = await page.getByTestId("player-status").textContent();
  await page.goto("/under-the-hood.html");
  await page.getByTestId("back-top").click();
  await expect(page.getByTestId("player-status")).toHaveText(model ?? "");
  await expect(page.getByTestId("verdict-locked")).toBeHidden();
  await expect(page.getByTestId("tryit")).toBeVisible();
  await expect(page.getByTestId("play-button")).toHaveText("▶ Run again");
  await expect(page.getByTestId("watch-again")).toBeVisible();
  await expect(page.getByTestId("run-graph")).toBeVisible();
});

test("the kept run is used once: a reload after coming back starts fresh", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  await page.goto("/under-the-hood.html");
  await page.getByTestId("back-top").click();
  await expect(page.getByTestId("tryit")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("player-status")).toHaveText("Ready. Choose the AI and press play.");
  await expect(page.getByTestId("verdict-locked")).toBeVisible();
});

test("the brute-force link in the verdict goes to the definition in the same tab, and the browser's Back brings the run back", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  await page.getByTestId("yardstick-link").first().click();
  await expect(page).toHaveURL(/under-the-hood\.html#brute-force$/);
  await page.goBack();
  await expect(page.getByTestId("play-button")).toHaveText("▶ Run again");
  await expect(page.getByTestId("verdict-locked")).toBeHidden();
});
