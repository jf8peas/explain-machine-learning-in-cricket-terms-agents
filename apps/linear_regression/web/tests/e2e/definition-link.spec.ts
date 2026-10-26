// Issue 11: a link to #brute-force ends on the definition even when the graph above it is drawn late, and leaves the page alone once the visitor scrolls.
import { expect, test, type Page } from "./fixtures";

test.use({ viewport: { width: 390, height: 664 } });

/** Answer /api/structure at once the first time (the page's own figures) and after `ms` for the next requests (the graph's own fetch), so the graph is drawn late. */
async function slowGraph(page: Page, ms: number) {
  let calls = 0;
  await page.route("**/api/structure", async (route) => {
    calls++;
    if (calls > 1) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test("the definition is in view and focused when the graph is drawn late", async ({ page }) => {
  await slowGraph(page, 1500);
  await page.goto("/under-the-hood.html#brute-force");
  const def = page.getByTestId("brute-force-def");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible({ timeout: 10_000 });
  await expect(def).toBeInViewport();
  await expect(def).toBeFocused();
  const box = (await def.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(664);
});

test("a visitor who scrolls away before the graph is drawn is not pulled back", async ({ page }) => {
  await slowGraph(page, 2500);
  await page.goto("/under-the-hood.html#brute-force");
  await expect(page.getByTestId("brute-force-def")).toBeFocused();
  await page.mouse.wheel(0, -4000);
  await page.waitForTimeout(300);
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(300);
});

test("a direct link to the definition lands on it", async ({ page }) => {
  await page.goto("/under-the-hood.html#brute-force");
  await expect(page.getByTestId("brute-force-def")).toBeInViewport();
  await expect(page.getByTestId("brute-force-def")).toHaveAttribute("id", "brute-force");
});
