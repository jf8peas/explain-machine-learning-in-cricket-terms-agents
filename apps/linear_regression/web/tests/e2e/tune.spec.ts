import { expect, test } from "@playwright/test";
import { open, playToEnd, timelineItems } from "./helpers";

test("the tune loop shows one comparison row per fit and the error falls", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const rows = page.getByTestId("attempt-row");
  await expect(rows).toHaveCount(3);
  const errors = (await rows.locator("td:nth-child(2)").allTextContents()).map(Number);
  expect(errors[1]).toBeLessThan(errors[0]);
  expect(errors[2]).toBeLessThanOrEqual(errors[1]);
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
});

test("the comparison grows as the run is replayed", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(5).click(); // first evaluate
  await expect(page.getByTestId("attempt-row")).toHaveCount(1);
  await timelineItems(page).nth(8).click(); // second evaluate
  await expect(page.getByTestId("attempt-row")).toHaveCount(2);
});
