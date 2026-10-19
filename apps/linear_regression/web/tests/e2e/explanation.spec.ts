import { expect, test } from "./fixtures";
import { open, openTab, playToEnd } from "./helpers";

test("the run ends with a cricket explanation and a clear comparison", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  await expect(page.getByTestId("takeaway")).toHaveCount(3);
  await expect(page.getByTestId("rule-of-thumb")).toBeVisible();
  await expect(page.getByTestId("verdict")).toContainText(/the TV projection/);

  // the numbers shown match the final state panel
  const final = JSON.parse((await page.locator('[data-key="final"] pre').textContent())!);
  const race = await page.getByTestId("race").textContent();
  expect(race).toContain(final.test_mae.forward.toFixed(1));
  expect(race).toContain(final.test_mae.llm.toFixed(1));
  expect(race).toContain(final.test_mae.tv.toFixed(1));
  await expect(page.getByTestId("verdict")).toContainText(`${Math.abs(final.improvement).toFixed(1)} runs`);
});

test("the Cricsheet attribution is visible in the results area", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toBeVisible();
  await expect(page.getByTestId("results-card").getByTestId("attribution")).toContainText("Cricsheet");
});

test("the choice made on the check years is stated in the verdict only when another method had the shortest bar", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const expl = JSON.parse((await page.locator('[data-key="explanation"] pre').textContent())!);
  const differs = expl.facts.race_leader_differs.value === true;
  await expect(page.getByTestId("verdict-leader")).toHaveCount(differs ? 1 : 0);
  if (differs) await expect(page.getByTestId("verdict-leader")).toContainText("before the test");
});
