// Issue 5: the hero keeps the phone order that fits the first screen, and the chart's drawings and text stay inside its card on small screens.
import { expect, test } from "./fixtures";

const rect = (page: import("@playwright/test").Page, id: string) => page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, visible: r.height > 0 }; });

// The lead sits under the button on a phone on purpose (feature 022): the question, the goal sentence and the button must share the 390 × 664 first screen,
// and a lead under the question pushes the button about 60 px below it. This guards that trade-off; changing it means making room elsewhere first.
test("on a 390 × 664 phone the lead stays under the button so the button is on the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  const goal = await rect(page, "goal-sentence"), lead = await rect(page, "hero-lead"), start = await rect(page, "start-experiment");
  expect(start.bottom).toBeLessThanOrEqual(664);
  expect(lead.top).toBeGreaterThanOrEqual(start.bottom - 1);
  expect(goal.bottom).toBeLessThanOrEqual(start.top);
});

for (const width of [320, 360, 390, 430]) {
  test(`at ${width} px the chart's drawings and every word in them stay inside the card`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/?view=everything");
    await page.getByTestId("worm-chart").locator("svg").first().waitFor();
    const out = await page.getByTestId("worm-card").evaluate((card) => {
      const c = card.getBoundingClientRect(), bad: string[] = [];
      for (const el of card.querySelectorAll("svg, svg text, svg rect")) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.left < c.left - 0.5 || r.right > c.right + 0.5)) bad.push(`${el.tagName} ${Math.round(r.left)}-${Math.round(r.right)} (card ${Math.round(c.left)}-${Math.round(c.right)})`);
      }
      return bad;
    });
    expect(out).toEqual([]);
  });
}
