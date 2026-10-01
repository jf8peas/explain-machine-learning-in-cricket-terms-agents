import { expect, test } from "@playwright/test";
import { countRunRequests, open, playToEnd, serveRun, sse, timelineItems } from "./helpers";

const EXPECTED_PATH = [
  "load_data", "explore", "split", "baseline",
  "fit_model", "evaluate", "tune", "fit_model", "evaluate", "tune", "fit_model", "evaluate",
  "explain_in_cricket_terms",
];

test("Play runs the whole agent in order, with marks, counts and a marker", async ({ page }) => {
  await open(page);
  await page.getByTestId("play").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  await expect(page.getByTestId("marker")).toBeVisible();
  await playToEnd(page);

  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  expect(names).toEqual(EXPECTED_PATH);
  // visited nodes stay marked; repeated nodes show a count
  await expect(page.locator(".node.visited")).toHaveCount(10); // 8 steps + start + end
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
  await expect(page.locator('[data-node="tune"]')).toHaveAttribute("data-visits", "2");
  await expect(page.locator('[data-node="load_data"]')).not.toHaveAttribute("data-visits", /.*/);
  // the conditional edges actually taken are marked; the other branch is not
  await expect(page.locator('[data-edge="evaluate->tune"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="evaluate->explain_in_cricket_terms"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="load_data->__end__"]')).not.toHaveClass(/taken/);
});

test("a marker travels along the edge taken (animated)", async ({ page }) => {
  await open(page, 1200);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("replay")).toHaveAttribute("data-animating", "true", { timeout: 5_000 });
});

test("reduced motion removes the travelling marker but keeps everything else", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.getByTestId("replay")).toHaveAttribute("data-reduced-motion", "true");
  await page.getByTestId("play").click();
  let animated = false;
  const watch = setInterval(async () => {
    animated = animated || (await page.getByTestId("replay").getAttribute("data-animating").catch(() => null)) === "true";
  }, 20);
  await playToEnd(page);
  clearInterval(watch);
  expect(animated).toBe(false);
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
  await expect(page.locator(".node.active")).toHaveCount(1);
});

test("pressing Play again mid-run starts clean without duplicate steps", async ({ page }) => {
  await open(page, 400);
  const requests = countRunRequests(page);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).toHaveCount(3, { timeout: 10_000 });
  await page.getByTestId("play").click();
  await expect.poll(() => timelineItems(page).count(), { timeout: 5_000 }).toBeLessThan(3); // started over
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("pause")).toBeDisabled();
  await expect(timelineItems(page)).toHaveCount(EXPECTED_PATH.length);
  expect(requests.count()).toBe(2);
});

test("a dropped connection keeps the received steps and says so", async ({ page }) => {
  await open(page);
  const step = (n: number, node: string) => sse("step", { step: n, node, summary: `did ${node}`, changes: { k: n } });
  await serveRun(page, step(1, "load_data") + step(2, "explore")); // no `done`
  await page.getByTestId("play").click();
  await expect(page.getByTestId("status")).toContainText("connection was lost");
  await expect(timelineItems(page)).toHaveCount(2);
  await timelineItems(page).first().click();
  await expect(page.getByTestId("event-node")).toHaveText("load_data");
});
