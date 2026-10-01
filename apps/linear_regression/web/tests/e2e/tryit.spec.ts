import { expect, test } from "@playwright/test";
import { open, playToEnd } from "./helpers";

const fill = async (page: import("@playwright/test").Page, runs: string, wk: string, pp: string) => {
  await page.locator('input[name="runs_at_10"]').fill(runs);
  await page.locator('input[name="wickets_at_10"]').fill(wk);
  await page.locator('input[name="powerplay_runs"]').fill(pp);
  await page.getByRole("button", { name: "Predict" }).click();
};

test("the form is disabled until a run has finished", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "Predict" })).toBeDisabled();
  await expect(page.getByTestId("tryit-hint")).toBeVisible();
});

test("valid input shows the model's prediction beside the TV projection", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByRole("button", { name: "Predict" })).toBeEnabled();
  await fill(page, "80", "2", "45");
  await expect(page.getByTestId("tryit-tv")).toHaveText("160");
  const model = Number(await page.getByTestId("tryit-model").textContent());
  expect(model).toBeGreaterThan(120);
  expect(model).toBeLessThan(220);
});

test("invalid input shows a message and no prediction", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  for (const [r, w, p, msg] of [
    ["-5", "2", "10", "negative"],
    ["80", "10", "40", "between 0 and 9"],
    ["40", "2", "50", "Powerplay runs cannot be more"],
    ["", "2", "10", "enter a number"],
  ]) {
    await fill(page, r, w, p);
    await expect(page.getByTestId("tryit-error")).toContainText(msg);
    await expect(page.getByTestId("tryit-result")).toBeHidden();
  }
});

test("the Cricsheet attribution is visible beside the form", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("tryit").getByTestId("attribution")).toContainText("Cricsheet");
});

test("stepping back through the run does not disable try-your-own", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await page.getByTestId("back").click();
  await page.getByTestId("back").click();
  await expect(page.getByRole("button", { name: "Predict" })).toBeEnabled();
});
