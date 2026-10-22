// The old links (feature 020): each anchor of the five-tab page still lands somewhere sensible on the one-page layout.
import { expect, test, type Page } from "./fixtures";

const top = async (page: Page, id: string) => (await page.locator(`#${id}`).boundingBox())!.y;

for (const [old, now] of [["#working", "watch"], ["#found", "verdict"], ["#final-test", "verdict"], ["#try-your-own", "try"]] as const) {
  test(`${old} lands on #${now}`, async ({ page }) => {
    await page.goto(`/${old}`);
    await expect(page.getByTestId("verdict-title")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${now}$`));
    await expect.poll(() => top(page, now)).toBeLessThan(200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });
}

test("#data lands on the Scorebook with The data open", async ({ page }) => {
  await page.goto("/#data");
  await expect(page).toHaveURL(/#scorebook$/);
  await expect(page.getByTestId("scorebook-panel")).toBeVisible();
  await expect(page.getByTestId("scorebook-card-data")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
  await expect.poll(() => top(page, "scorebook")).toBeLessThan(200);
});

test("the link in the done-beforehand item's summary opens the data in the Scorebook", async ({ page }) => {
  await page.goto("/?view=everything");
  await page.getByTestId("item").click();
  await page.getByTestId("item-link").click();
  await expect(page).toHaveURL(/#scorebook$/);
  await expect(page.getByTestId("scorebook-card-data")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
});

test("a new anchor is left alone", async ({ page }) => {
  await page.goto("/#verdict");
  await expect(page).toHaveURL(/#verdict$/);
  await expect(page.getByTestId("scorebook-panel")).toBeHidden();
});
