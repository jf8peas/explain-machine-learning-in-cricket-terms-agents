import { expect, test } from "./fixtures";
import { countRunRequests, open, playToEnd, timelineItems, toPlayer } from "./helpers";

const current = (page: import("@playwright/test").Page) => page.locator('[data-testid=timeline-item][aria-current="step"]');

test("stepping, the timeline and Reset replay from the buffer without running the agent", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page);
  await playToEnd(page);
  const runRequests = requests.count();                                       // the one live run that was just made
  const last = (await timelineItems(page).count()) - 1;
  await expect(current(page)).toContainText("write_in_cricket_terms");

  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveText(`${last}. explain_in_cricket_terms`);
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toHaveText(`${last - 1}. final_test`);
  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toHaveText(`${last}. explain_in_cricket_terms`);

  await timelineItems(page).nth(2).click();
  await expect(page.getByTestId("event-node")).toHaveText("explore");
  await page.getByTestId("back").click();
  await expect(page.getByTestId("event-node")).toHaveText("split");

  expect(requests.count()).toBe(runRequests); // nothing was fetched: the run was kept

  await page.getByTestId("reset").click();                                    // back to before the first step; the run is kept
  await expect(page.locator(".node.active")).toHaveCount(0);
  await expect(page.getByTestId("event-node")).toHaveCount(0);
  await expect(timelineItems(page)).not.toHaveCount(0);
  await page.getByTestId("watch-again").click();                             // and it can be watched again
  await expect(page.locator(".node.active")).toHaveCount(1);
  expect(requests.count()).toBe(runRequests);
});

test("stepping past either end is ignored", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await page.keyboard.press("ArrowRight");
  await expect(current(page)).toContainText("write_in_cricket_terms");
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
  await page.getByTestId("model-select").focus();                           // the select that chooses the AI
  await page.keyboard.press("ArrowLeft");
  await expect(current(page)).toContainText("write_in_cricket_terms");
});

test("Pause stops the replay and Resume continues", async ({ page }) => {
  await open(page, 500);
  await page.getByTestId("watch-again").click();                              // a finished run is replayed at the chosen pace
  await expect(page.getByTestId("pause")).toHaveText("Pause");
  await expect(timelineItems(page)).not.toHaveCount(0);
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("pause")).toHaveText("Resume");
  const shown = await page.getByTestId("event-node").textContent();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("event-node")).toHaveText(shown!);
  await page.getByTestId("pause").click();
  await expect(page.getByTestId("pause")).toHaveText("Pause");
});
