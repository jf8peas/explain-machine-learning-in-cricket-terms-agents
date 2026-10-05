import { expect, test } from "./fixtures";
import { open, playToEnd, timelineItems } from "./helpers";

const rows = (page: import("@playwright/test").Page, changed: boolean) =>
  page.locator(`[data-testid=state] .row[data-changed="${changed}"]`);
const keys = async (loc: import("@playwright/test").Locator) => (await loc.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key))).sort();

test("each step shows its event and the state, with only that step's changes highlighted", async ({ page }) => {
  await open(page);
  await playToEnd(page);

  await timelineItems(page).nth(0).click(); // load_data
  await expect(page.getByTestId("event-node")).toHaveText("load_data");
  await expect(page.getByTestId("event-summary")).toContainText("Loaded");
  expect(await keys(rows(page, true))).toEqual(["data_error", "data_summary", "decision", "model_name"]);
  expect(await rows(page, false).count()).toBe(0);

  await timelineItems(page).nth(3).click(); // baseline
  await expect(page.getByTestId("event-node")).toHaveText("baseline");
  expect(await keys(rows(page, true))).toEqual(["baseline_validation_mae"]);
  expect(await keys(rows(page, false))).toEqual(["data_error", "data_summary", "decision", "explore", "model_name", "split"]);

  await timelineItems(page).nth(7).click(); // first evaluate
  expect(await keys(rows(page, true))).toEqual(["attempts", "decision", "llm_best", "no_improve"]);
  await expect(page.locator('[data-key="data_summary"]')).toHaveAttribute("data-changed", "false");
  // the change is flagged in words too, not only colour
  await expect(rows(page, true).first().locator(".badge")).toHaveText("changed in this step");
});

test("stepping back shows exactly what the step showed originally", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(7).click();
  const first = await page.getByTestId("state").innerHTML();
  await timelineItems(page).nth(12).click();
  await timelineItems(page).nth(7).click();
  expect(await page.getByTestId("state").innerHTML()).toBe(first);
});
