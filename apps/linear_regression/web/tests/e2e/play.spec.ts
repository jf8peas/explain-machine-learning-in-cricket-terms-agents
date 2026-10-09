import { expect, test } from "./fixtures";
import { finishRun, open, serveRun, sse, timelineItems } from "./helpers";

// The scripted default model (fake/steady) on the committed data: three fitted rounds, one repeat that code rejects,
// then "finished"; forward selection adds eight features; then the final test and the explanation.
const FIT_ROUND = ["propose_features", "check_proposal", "fit_model", "evaluate"];
const EXPECTED_PATH = [
  "load_data", "split", "explore", "baseline",
  ...FIT_ROUND, ...FIT_ROUND, ...FIT_ROUND,
  "propose_features", "check_proposal",               // the repeat, rejected
  "propose_features", "check_proposal",               // "finished"
  ...Array(8).fill("forward_selection"),
  "final_test", "explain_in_cricket_terms",
];

test("Play runs the whole agent in order, with marks, counts and a marker", async ({ page }) => {
  await open(page);
  await page.getByTestId("play").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  await expect(page.getByTestId("marker")).toBeVisible();
  await finishRun(page);   // Play was already pressed above; pressing it again would start a second run

  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  expect(names).toEqual(EXPECTED_PATH);
  // visited nodes stay marked; repeated nodes show a count
  await expect(page.locator(".node.visited")).toHaveCount(13); // 11 steps + start + end
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
  await expect(page.locator('[data-node="propose_features"]')).toHaveAttribute("data-visits", "5");
  await expect(page.locator('[data-node="forward_selection"]')).toHaveAttribute("data-visits", "8");
  await expect(page.locator('[data-node="load_data"]')).not.toHaveAttribute("data-visits", /.*/);
  // the conditional edges actually taken are marked; the other branch is not
  await expect(page.locator('[data-edge="evaluate->propose_features"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="check_proposal->propose_features"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="check_proposal->forward_selection"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="forward_selection->forward_selection"]')).toHaveClass(/taken/);
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
  await finishRun(page);   // Play was already pressed above; pressing it again would start a second run
  clearInterval(watch);
  expect(animated).toBe(false);
  await expect(page.locator('[data-node="fit_model"]')).toHaveAttribute("data-visits", "3");
  await expect(page.locator(".node.active")).toHaveCount(1);
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

test("Play stays disabled until the graph has been drawn", async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/structure", async (route) => { await gate; await route.continue(); });
  await page.goto("/");
  await expect(page.getByTestId("play")).toBeDisabled();
  await expect(page.locator('[data-node="load_data"]')).toHaveCount(0);
  release();
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await expect(page.getByTestId("play")).toBeEnabled();
});
