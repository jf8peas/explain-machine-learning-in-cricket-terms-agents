import { expect, test, type Page } from "./fixtures";
import { open, playToEnd } from "./helpers";

// Plausible values for whatever the winning model asks for (the form is built from the model's own features).
const PLAUSIBLE: Record<string, string> = {
  runs_at_10: "80", wickets_at_10: "2", powerplay_runs: "45", powerplay_wickets: "1", runs_overs_7_10: "35",
  wickets_overs_7_10: "1", fours_at_10: "7", sixes_at_10: "2", dot_balls_at_10: "25", extras_at_10: "4",
  partnership_runs: "22", balls_since_last_wicket: "18",
};
const DERIVED = ["wickets_in_hand", "runs_x_wickets_in_hand", "is_ipl", "is_bbl"];

const askedFor = (page: Page) =>
  page.locator("[data-testid=tryit-fields] input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name));

const fillAll = async (page: Page, overrides: Record<string, string> = {}) => {
  for (const name of await askedFor(page)) await page.locator(`input[name="${name}"]`).fill(overrides[name] ?? PLAUSIBLE[name] ?? "5");
  const select = page.locator("[data-testid=tryit-fields] select");
  if (await select.count()) await select.selectOption("ipl");
  await page.getByRole("button", { name: "Predict", exact: true }).click();
};

test("the form is disabled until a run has finished", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeDisabled();
  await expect(page.getByTestId("tryit-hint")).toBeVisible();
});

test("the form asks for the winning model's inputs only, starting with runs at 10 overs", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeEnabled();
  const final = JSON.parse((await page.locator('[data-key="final"] pre').textContent())!);
  const winner: string[] = final.sets[final.winner];
  const asked = await askedFor(page);
  expect(asked[0]).toBe("runs_at_10");
  for (const derived of DERIVED) expect(asked).not.toContain(derived);
  if (winner.includes("is_ipl") || winner.includes("is_bbl")) await expect(page.locator("[data-testid=tryit-fields] select")).toHaveCount(1);
  for (const f of winner.filter((f) => !DERIVED.includes(f))) expect(asked).toContain(f);
});

test("valid input shows the model's prediction beside the TV projection", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeEnabled();
  await fillAll(page, { runs_at_10: "80" });
  await expect(page.getByTestId("tryit-tv")).toHaveText("160");
  const model = Number(await page.getByTestId("tryit-model").textContent());
  expect(model).toBeGreaterThan(100);
  expect(model).toBeLessThan(240);
});

test("invalid input shows a message and no prediction", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeEnabled();
  for (const [name, value, msg] of [
    ["runs_at_10", "-5", "negative"],
    ["wickets_at_10", "10", "between 0 and 9"],
    ["runs_at_10", "", "enter a number"],
    ["runs_at_10", "7.5", "whole number"],
  ]) {
    if (!(await page.locator(`input[name="${name}"]`).count())) continue; // not asked for by this winning model
    await fillAll(page, { [name]: value });
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
  await expect(page.getByRole("button", { name: "Predict", exact: true })).toBeEnabled();
});
