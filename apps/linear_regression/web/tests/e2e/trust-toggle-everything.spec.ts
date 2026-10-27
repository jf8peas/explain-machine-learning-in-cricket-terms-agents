// Issue 21: with "Show me everything" on, the "Why you can trust this score" toggle does nothing, so it is not shown; in the simple view it still opens the panel.
import { expect, test } from "./fixtures";
import { finishRun } from "./helpers";

for (const [name, width, height] of [["phone", 390, 664], ["desktop", 1280, 900]] as const) {
  test(`on a ${name} the trust toggle is hidden under Show me everything, with its panel open, and works in the simple view`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/?interval=40");
    await finishRun(page);
    const toggle = page.getByTestId("trust-toggle");
    const panel = page.getByTestId("trust-panel");
    await expect(toggle).toBeVisible();
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(panel).toBeVisible();
    await page.evaluate(() => { document.body.dataset.view = "everything"; document.dispatchEvent(new CustomEvent("viewchange", { detail: "everything" })); });
    await expect(toggle).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await page.evaluate(() => { document.body.dataset.view = "simple"; document.dispatchEvent(new CustomEvent("viewchange", { detail: "simple" })); });
    await expect(toggle).toBeVisible();
  });
}
