// Issue 12: the graph's disclosures say what they will do, and show their arrow on every screen size (the phone layout used to lose it).
import { expect, test, type Page } from "./fixtures";
import { open } from "./helpers";

const arrow = (page: Page, testid: string) =>
  page.getByTestId(testid).evaluate((d) => getComputedStyle(d.querySelector("summary")!, "::before").content);

for (const [name, width, height] of [["phone", 390, 664], ["desktop", 1280, 900]] as const) {
  test(`on a ${name} the state panel's label flips between Show and Hide every value, and its arrow points the right way`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const raw = page.getByTestId("raw-state");
    const summary = raw.locator("summary");
    await expect(summary).toHaveText("Show every value");
    expect(await arrow(page, "raw-state")).toBe('"▸"');
    await summary.click();
    await expect(summary).toHaveText("Hide every value");
    expect(await arrow(page, "raw-state")).toBe('"▾"');
    await summary.click();
    await expect(summary).toHaveText("Show every value");
    expect(await arrow(page, "raw-state")).toBe('"▸"');
  });

  test(`on a ${name} Path taken has its arrow too`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    // the helper may have opened it already: whichever it is, the arrow matches the state, and clicking flips both
    const path = page.getByTestId("path");
    for (let i = 0; i < 3; i++) {
      const opened = await path.evaluate((d) => (d as HTMLDetailsElement).open);
      expect(await arrow(page, "path")).toBe(opened ? '"▾"' : '"▸"');
      await path.locator("summary").click();
      expect(await path.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(!opened);
    }
  });
}

test("the arrow is not drawn twice (the browser's own marker is off)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  expect(await page.getByTestId("raw-state").evaluate((d) => getComputedStyle(d.querySelector("summary")!).listStyleType)).toBe("none");
});
