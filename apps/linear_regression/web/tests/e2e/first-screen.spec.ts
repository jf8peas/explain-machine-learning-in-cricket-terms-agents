// The first screen on LinkedIn's in-app browser (390 x 664): the headline and both averages are in view with nothing scrolled or
// pressed, the hero reads kicker, h1, card, lead, links, and the header fits one row (feature 020, FR-020, SC-001).
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 664 } });

test("the headline and both average misses are on the first screen, in the right order", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("scoreboard-agent")).toBeVisible();
  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  const [kicker, title, card, lead, links] = [await box("hero-kicker"), await box("hero-title"), await box("scoreboard-card"), await box("hero-lead"), await box("hero-links")];
  expect(kicker.y).toBeLessThan(title.y);
  expect(title.y + title.height).toBeLessThanOrEqual(card.y + 1);
  expect(card.y + card.height).toBeLessThanOrEqual(lead.y + 1);
  expect(lead.y + lead.height).toBeLessThanOrEqual(links.y + 1);
  for (const id of ["hero-title", "scoreboard-agent", "scoreboard-tv"]) {
    const b = await box(id);
    expect(b.y + b.height, `${id} ends inside the 664 px screen`).toBeLessThanOrEqual(664);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the header fits one row at 390 px: the app name and three 44 px icon buttons with their full names", async ({ page }) => {
  await page.goto("/");
  const ids = ["breadcrumb", "view-switch", "link-under-the-hood", "link-feedback"];
  const boxes = await Promise.all(ids.map(async (id) => (await page.getByTestId(id).boundingBox())!));
  const centres = boxes.map((b) => b.y + b.height / 2);
  expect(Math.max(...centres) - Math.min(...centres), "all four share one row").toBeLessThan(4);
  for (const b of boxes.slice(1)) { expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44); }
  const shown = await page.getByTestId("breadcrumb").evaluate((el) => (el as HTMLElement).innerText);      // what is visible, not the hidden link
  expect(shown.trim()).toBe("Linear regression");
  await expect(page.getByRole("button", { name: "Show me everything" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How it was built", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Feedback (opens the GitHub issues page in a new tab)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
