import { expect, test } from "@playwright/test";
import { open, playToEnd } from "./helpers";

test("the run ends with a cricket explanation and a clear comparison", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("explanation").locator("li")).not.toHaveCount(0);
  await expect(page.getByTestId("explanation")).toContainText("halfway mark");
  await expect(page.getByTestId("verdict")).toContainText(/beat the TV projection/);

  // the numbers shown match the final state panel
  const modelMae = Number(await page.locator('[data-key="model_mae"] pre').textContent());
  const baseMae = Number(await page.locator('[data-key="baseline_mae"] pre').textContent());
  const compare = await page.getByTestId("comparison").textContent();
  expect(compare).toContain(modelMae.toFixed(1));
  expect(compare).toContain(baseMae.toFixed(1));
  await expect(page.getByTestId("explanation")).toContainText(`${modelMae.toFixed(1)} runs`);
});

test("the Cricsheet attribution is visible in the results area", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toBeVisible();
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toContainText("Cricsheet");
});
