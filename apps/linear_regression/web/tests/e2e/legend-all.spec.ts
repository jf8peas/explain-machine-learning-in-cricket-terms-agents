// Issue 13: the stage legend's All button shows when it is the selection, and says what All means instead of "Select a stage." (phone and desktop).
import { expect, test } from "./fixtures";
import { open } from "./helpers";

const stage = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-testid="legend-stage"][data-stage="${id}"]`);

for (const [name, width, height] of [["phone", 390, 664], ["desktop", 1280, 900]] as const) {
  test(`on a ${name} All is highlighted by default, hands the highlight to a chosen stage, and takes it back`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const all = page.getByTestId("legend-all");
    const ring = () => all.evaluate((el) => getComputedStyle(el).boxShadow);
    await expect(all).toHaveAttribute("aria-pressed", "true");
    expect(await ring()).not.toBe("none");
    await stage(page, "split").click();
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await expect(stage(page, "split")).toHaveAttribute("aria-pressed", "true");
    expect(await ring()).toBe("none");
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(stage(page, "split")).toHaveAttribute("aria-pressed", "false");
    expect(await ring()).not.toBe("none");
    await stage(page, "split").click();                              // clicking the chosen stage again also goes back to All
    await stage(page, "split").click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
  });
}

test("on a phone the line under the stage chips says what All means and describes the chosen stage otherwise", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await open(page);
  const structure = await (await page.request.get("/api/structure")).json() as { stages: { id: string; name: string; question: string }[] };
  const detail = page.getByTestId("legend-detail");
  await expect(detail).toBeVisible();
  await expect(detail).not.toHaveText("Select a stage.");
  await expect(detail).toHaveText(`All ${structure.stages.length} stages shown. Pick a number to read one.`);
  await stage(page, structure.stages[2].id).click();
  await expect(detail).toContainText(structure.stages[2].name);
  await expect(detail).toContainText(structure.stages[2].question);
  await expect(detail).not.toContainText(structure.stages[3].name);
  await page.getByTestId("legend-all").click();
  await expect(detail).toHaveText(`All ${structure.stages.length} stages shown. Pick a number to read one.`);
});
