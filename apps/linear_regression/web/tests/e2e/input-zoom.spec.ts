// Issue 19: iOS Safari zooms the page when a field's text is under 16px and does not zoom back out, so every field is at least 16px.
import { expect, test } from "./fixtures";
import { toPlayer } from "./helpers";

test("every input and select on the main page is at least 16px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/?view=everything");
  await toPlayer(page);
  const sizes = await page.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
    .filter((el) => (el as HTMLElement).offsetParent !== null)
    .map((el) => ({ el: `${el.tagName}#${el.id || (el as HTMLInputElement).name}`, size: parseFloat(getComputedStyle(el).fontSize) })));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s.size, s.el).toBeGreaterThanOrEqual(16);
});
