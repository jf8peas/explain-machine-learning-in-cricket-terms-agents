import { expect, test } from "./fixtures";
import { countRunRequests, open, playToEnd, timelineItems } from "./helpers";

const current = (page: import("@playwright/test").Page) => page.locator('[data-testid=timeline-item][aria-current="step"]');

test("stepping, the timeline and Reset replay from the buffer without rerunning the agent", async ({ page }) => {
  await open(page);
  const requests = countRunRequests(page);
  await playToEnd(page);
  expect(requests.count()).toBe(1);
  const last = (await timelineItems(page).count()) - 1;
  await expect(current(page)).toContainText("explain_in_cricket_terms");

  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveText(`${last}. final_test`);
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveText(`${last - 1}. grid_search`);
  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toHaveText(`${last}. final_test`);

  await timelineItems(page).nth(2).click();
  await expect(page.getByTestId("event-node")).toHaveText("explore");
  await page.getByTestId("back").click();
  await expect(page.getByTestId("event-node")).toHaveText("split");

  expect(requests.count()).toBe(1); // nothing was refetched

  await page.getByTestId("reset").click();
  await expect(timelineItems(page)).toHaveCount(0);
  await expect(page.locator(".node.active")).toHaveCount(0);
  await expect(page.getByTestId("status")).toContainText("Press Play");
});

test("stepping past either end is ignored", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toContainText("explain_in_cricket_terms");
  await timelineItems(page).first().click();
  await page.keyboard.press("ArrowLeft"); // back to before the first step
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".node.active")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toContainText("load_data");
});

test("arrow keys do not step while typing in a field", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await page.locator('input[name="runs_at_10"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toContainText("explain_in_cricket_terms");
});

test("Pause stops the display and Resume continues", async ({ page }) => {
  await open(page, 500);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).not.toHaveCount(0);
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("pause")).toHaveText("Resume");
  const shown = await page.getByTestId("event-node").textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("event-node")).toHaveText(shown!);
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("pause")).toHaveText("Pause");
});
