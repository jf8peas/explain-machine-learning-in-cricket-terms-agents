// Issue 10: the footer links on How this app was built keep their words on a phone and do not run into each other.
import { expect, test } from "./fixtures";

for (const width of [320, 360, 390]) {
  test(`at ${width} px the footer links show their text, stay inside the page and do not overlap`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/under-the-hood.html");
    await page.getByTestId("back-footer").scrollIntoViewIfNeeded();
    const boxes = await page.locator(".foot-links .about-link").evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { text: (e.textContent ?? "").replace(/\s+/g, " ").trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom, scrollW: (e as HTMLElement).scrollWidth, clientW: (e as HTMLElement).clientWidth };
    }));
    expect(boxes.length).toBe(2);
    for (const b of boxes) {
      expect(b.text.length, "has its words").toBeGreaterThan(5);
      expect(b.scrollW, `${b.text} is not wider than its box`).toBeLessThanOrEqual(b.clientW + 1);
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
    }
    const [a, c] = boxes;
    const apart = a.bottom <= c.top + 0.5 || c.bottom <= a.top + 0.5 || a.right <= c.left + 0.5 || c.right <= a.left + 0.5;
    expect(apart, "the two links do not overlap").toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("the header's links still shrink to icons on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/under-the-hood.html");
  expect((await page.getByTestId("link-feedback").boundingBox())!.width).toBeLessThanOrEqual(44);
});
