// Issue 8: a rejected round's long reason sits under the round's text, across the row, and never squeezes or overlaps it.
import { expect, test } from "./fixtures";
import { open } from "./helpers";

const LONG = "code rejected: wickets lost at the halfway mark and wickets in hand say almost the same thing, so the model could not tell them apart. Try dropping one of them.";

for (const width of [360, 390, 700, 1000]) {
  test(`at ${width} px a long rejection sits under the idea and quote, inside the row, without squeezing them`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const row = page.locator('[data-testid=round-item][data-status="rejected"]');
    await expect(row).toHaveCount(1);
    await row.getByTestId("round-status").evaluate((e, text) => { e.textContent = text; }, LONG);
    const m = await row.evaluate((r) => {
      const q = r.getBoundingClientRect(), main = r.querySelector(".round-main")!.getBoundingClientRect(), tag = r.querySelector(".status-tag")!.getBoundingClientRect();
      const idea = r.querySelector(".round-idea")!.getBoundingClientRect();
      return { row: [q.left, q.right], rowW: q.width, mainW: main.width, mainBottom: main.bottom, tag: [tag.left, tag.right, tag.top], ideaH: idea.height, ideaBottom: idea.bottom, radius: getComputedStyle(r.querySelector(".status-tag")!).borderRadius };
    });
    expect(m.tag[2], "the tag is under the idea and quote").toBeGreaterThanOrEqual(m.mainBottom - 0.5);
    expect(m.tag[0]).toBeGreaterThanOrEqual(m.row[0]);
    expect(m.tag[1]).toBeLessThanOrEqual(m.row[1] + 0.5);
    expect(m.mainW, "the text column keeps its width").toBeGreaterThan(m.rowW * 0.55);
    expect(m.ideaH, "the idea is not wrapped to a sliver").toBeLessThan(120);
    expect(m.radius).toBe("14px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("a short status stays beside the idea on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await open(page);
  const side = await page.getByTestId("round-item").first().evaluate((row) => {
    const main = row.querySelector(".round-main")!.getBoundingClientRect(), result = row.querySelector(".round-result")!.getBoundingClientRect();
    return result.left >= main.right - 0.5;
  });
  expect(side).toBe(true);
});
