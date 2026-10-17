import { expect, test } from "./fixtures";
import { loadEnv } from "vite";
import { open } from "./helpers";

test("the hero is visible and its breadcrumb links back to the main site in the same tab", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("hero")).toBeVisible();
  const siteUrl = loadEnv("development", process.cwd(), "VITE_").VITE_SITE_URL;
  const link = page.getByTestId("breadcrumb").getByRole("link", { name: "Explain Machine Learning in Cricket Terms" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", siteUrl);
  await expect(link).not.toHaveAttribute("target", /.+/);
  await expect(page.getByTestId("tv-sentence")).toContainText("The agent has to beat it by at least 3 runs.");
});

test("the whole graph is drawn before anything runs", async ({ page }) => {
  await open(page);
  for (const id of ["load_data", "split", "explore", "baseline", "propose_features", "check_proposal", "fit_model", "evaluate",
    "grid_search", "final_test", "explain_in_cricket_terms", "write_in_cricket_terms"]) {
    await expect(page.locator(`[data-node="${id}"]`)).toBeVisible();
  }
  expect(await page.locator(".edge:not(.item-edge)").count()).toBe(17);          // the agent's own edges
  expect(await page.locator(".edge.item-edge").count()).toBe(1);                 // plus the done-beforehand connector
  expect(await page.locator(".node.active").count()).toBe(0);
  expect(await page.locator(".node.visited").count()).toBe(0);
});

test("conditional edges are dashed and labelled with their branch", async ({ page }) => {
  await open(page);
  const conditional = page.locator(".edge.conditional");
  await expect(conditional).toHaveCount(7);
  const labels = await conditional.locator("text").allTextContents();
  expect(labels.sort()).toEqual(["continue", "finished", "fit", "ok", "rejected", "stop", "stop"]);
  const dash = await conditional.first().locator("path").evaluate((p) => getComputedStyle(p).strokeDasharray);
  expect(dash).not.toBe("none");
  const plain = await page.locator(".edge:not(.conditional)").first().locator("path").evaluate((p) => getComputedStyle(p).strokeDasharray);
  expect(plain).toBe("none");
});

test("the Cricsheet attribution is visible", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("footer-attribution")).toContainText("Cricsheet");
  await expect(page.getByTestId("footer-attribution")).toBeVisible();
});
