// Issue 7: on a small phone the agent's quoted reasoning in a round row has the row's width, not a squeezed column beside the score.
import { expect, test } from "./fixtures";
import { finishRun } from "./helpers";

for (const width of [360, 390]) {
  test(`at ${width} px each round's quote is nearly as wide as the round, with the score and status under it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/?interval=40&view=everything");
    await finishRun(page);
    const rows = page.getByTestId("round-item");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const m = await rows.nth(i).evaluate((row) => {
        const box = (sel: string) => row.querySelector(sel)?.getBoundingClientRect();
        const r = row.getBoundingClientRect(), main = box(".round-main")!, result = box(".round-result")!, quote = box(".reason");
        return { row: r.width, main: main.width, quote: quote?.width, below: result.top >= main.bottom - 0.5 };
      });
      expect(m.main, `round ${i + 1} text column`).toBeGreaterThan(m.row * 0.85);
      if (m.quote !== undefined) expect(m.quote, `round ${i + 1} quote`).toBeGreaterThan(m.row * 0.8);
      expect(m.below, `round ${i + 1}: score and status under the text`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test("on a wide screen the score and status stay beside the round's text", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/?interval=40&view=everything");
  await finishRun(page);
  const side = await page.getByTestId("round-item").first().evaluate((row) => {
    const main = row.querySelector(".round-main")!.getBoundingClientRect(), result = row.querySelector(".round-result")!.getBoundingClientRect();
    return result.left >= main.right - 0.5;
  });
  expect(side).toBe(true);
});
