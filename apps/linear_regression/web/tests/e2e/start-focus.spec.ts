// Issue 6: Start scrolls to the player once, then focuses the AI picker without scrolling the page a second time.
import { expect, test } from "./fixtures";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test("Start scrolls to the player, focuses the AI picker, and the page does not move again afterwards", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("start-experiment").click();
    const select = page.getByTestId("player").locator("select").first();
    await expect(select).toBeFocused();
    const at = await page.evaluate(() => window.scrollY);
    const box = (await select.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(664);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.scrollY)).toBe(at);                  // nothing scrolled after the focus
    expect(await select.boundingBox()).toEqual(box);                            // so the picker opens where the select is
    expect(await page.evaluate(() => location.hash)).toBe("#watch");
  });
});
