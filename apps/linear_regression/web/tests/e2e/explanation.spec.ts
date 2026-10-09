import { expect, test } from "./fixtures";
import { open, playToEnd } from "./helpers";

test("the run ends with a cricket explanation and a clear comparison", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("explanation").locator("li")).not.toHaveCount(0);
  await expect(page.getByTestId("explanation")).toContainText("halfway mark");
  await expect(page.getByTestId("verdict")).toContainText(/the TV projection/);

  // the numbers shown match the final state panel
  const final = JSON.parse((await page.locator('[data-key="final"] pre').textContent())!);
  const compare = await page.getByTestId("comparison").textContent();
  expect(compare).toContain(final.test_mae.forward.toFixed(1));
  expect(compare).toContain(final.test_mae.llm.toFixed(1));
  expect(compare).toContain(final.test_mae.tv.toFixed(1));
  await expect(page.getByTestId("explanation")).toContainText(`${final.winner_mae.toFixed(1)} runs`);
});

test("the Cricsheet attribution is visible in the results area", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toBeVisible();
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toContainText("Cricsheet");
});

test("the explanation states the winning setup in cricket language", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const sentence = page.getByTestId("explanation").locator("li").filter({ hasText: "The winning setup learned from" });
  await expect(sentence).toHaveCount(1);
  await expect(sentence).toContainText("using");
  await expect(page.getByTestId("explanation")).toContainText("three check years");
});
