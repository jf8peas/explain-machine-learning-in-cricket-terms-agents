import { expect, test } from "./fixtures";
import { countRunRequests, open, playToEnd, timelineItems } from "./helpers";

// The scripted default model (fake/steady) on the committed data, as recorded: three fitted rounds, one repeat that code rejects,
// then "finished"; the rival's grid search is one step; then the final test and the explanation.
const FIT_ROUND = ["propose_features", "check_proposal", "fit_model", "evaluate"];
const EXPECTED_PATH = [
  "load_data", "split", "explore", "baseline",
  ...FIT_ROUND, ...FIT_ROUND, ...FIT_ROUND,
  "propose_features", "check_proposal",               // the repeat, rejected
  "propose_features", "check_proposal",               // "finished"
  "grid_search",
  "final_test", "explain_in_cricket_terms", "write_in_cricket_terms",
];

test("the recorded run plays the whole agent in order, with marks and counts, and starts no run", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page);
  await playToEnd(page);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  expect(names).toEqual(EXPECTED_PATH);
  await expect(page.locator(".node.visited")).toHaveCount(12);
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
  await expect(page.locator('[data-node="propose_features"]')).toHaveAttribute("data-visits", "5");
  await expect(page.locator('[data-node="grid_search"]')).not.toHaveAttribute("data-visits", /.*/);   // visited once
  await expect(page.locator('[data-node="load_data"]')).not.toHaveAttribute("data-visits", /.*/);
  await expect(page.locator(".node.active")).toHaveCount(1);
  expect(requests.count()).toBe(0);
});

test("starting a live run before the graph has been drawn waits, and says so", async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/structure", async (route) => { await gate; await route.continue(); });
  await page.goto("/?view=everything");
  await expect(page.locator('[data-node="load_data"]')).toHaveCount(0);
  await page.getByTestId("live-start").click();
  await expect(page.getByTestId("live-message")).toContainText("still loading");
  release();
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await expect(page.getByTestId("live-start")).toBeEnabled();
});

test("the page has a favicon that is served", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(href).toBe("/favicon.svg");
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("svg");
  expect(await res.text()).toContain("<svg");
});
